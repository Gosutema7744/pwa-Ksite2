import React, { useState, useRef, useEffect } from "react"
import {
  Play,
  Download,
  Upload,
  Plus,
  Trash2,
  MessageSquare,
  AlertTriangle,
  PlayCircle,
  XCircle,
  Dices
} from "lucide-react"

// ==========================================
// ユーティリティ & 初期データ
// ==========================================
const generateId = prefix =>
  `${prefix}_${Math.random()
    .toString(36)
    .substr(2, 6)}`

const DEFAULT_NODE = {
  id: "",
  type: "normal",
  x: 0,
  y: 0,
  speaker: "",
  portrait: "",
  emotion_icon: "",
  text: "",
  notes: "",
  choices: [],
  conditions: [],
  effects: [],
  branches: [],
  condition_match_type: "AND"
}

const initialNodes = [
  {
    ...DEFAULT_NODE,
    id: "n_start",
    type: "start",
    x: 100,
    y: 300,
    notes: "会話開始"
  },
  {
    ...DEFAULT_NODE,
    id: "n_001",
    type: "normal",
    x: 300,
    y: 250,
    speaker: "NPC_A",
    text: "おや、来たね。",
    notes: "最初の挨拶"
  },
  {
    ...DEFAULT_NODE,
    id: "n_002",
    type: "normal",
    x: 600,
    y: 250,
    speaker: "NPC_A",
    text: "何か用かい？",
    choices: [
      {
        id: "c1",
        text: "こんにちは",
        effects: [{ type: "set_flag", key: "met_before", value: true }]
      },
      { id: "c2", text: "用事はない", effects: [] }
    ]
  },
  {
    ...DEFAULT_NODE,
    id: "n_003",
    type: "end",
    x: 950,
    y: 150,
    notes: "会話終了"
  },
  {
    ...DEFAULT_NODE,
    id: "n_004",
    type: "normal",
    x: 950,
    y: 350,
    speaker: "NPC_A",
    text: "そうかい。じゃあね。"
  },
  {
    ...DEFAULT_NODE,
    id: "n_005",
    type: "probability",
    x: 600,
    y: 450,
    branches: [
      { id: "b1", weight: 5 },
      { id: "b2", weight: 3 }
    ]
  }
]

const initialEdges = [
  { id: "e_1", source: "n_start", target: "n_001", sourceHandle: "out" },
  { id: "e_2", source: "n_001", target: "n_002", sourceHandle: "out" },
  { id: "e_3", source: "n_002", target: "n_003", sourceHandle: "c1" },
  { id: "e_4", source: "n_002", target: "n_004", sourceHandle: "c2" }
]

// 話者ごとのカラーパレット
const getSpeakerColor = speaker => {
  if (!speaker) return "bg-slate-700 border-slate-600"
  const colors = [
    "bg-red-900 border-red-700",
    "bg-blue-900 border-blue-700",
    "bg-emerald-900 border-emerald-700",
    "bg-purple-900 border-purple-700",
    "bg-amber-900 border-amber-700"
  ]
  let hash = 0
  for (let i = 0; i < speaker.length; i++)
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ==========================================
// メインアプリケーション
// ==========================================
export default function App() {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  // キャンバスの操作状態
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [interaction, setInteraction] = useState({ type: "none" }) // none, pan, drag_node, draw_edge

  const canvasRef = useRef(null)

  // プレビュー状態
  const [previewMode, setPreviewMode] = useState(false)

  // マウスホイールでのズーム処理 (ブラウザのデフォルトスクロールを防ぐ)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleWheel = e => {
      e.preventDefault()
      const zoomSensitivity = 0.001
      const delta = -e.deltaY * zoomSensitivity
      setTransform(prev => ({
        ...prev,
        scale: Math.min(Math.max(0.2, prev.scale + delta), 3)
      }))
    }
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [])

  // --- キャンバスのイベントハンドラ ---
  const getLogicalPosition = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale
    }
  }

  const onMouseDown = e => {
    // 結線ポートのクリック処理
    if (e.target.dataset.port) {
      e.stopPropagation()
      const pos = getLogicalPosition(e.clientX, e.clientY)
      setInteraction({
        type: "draw_edge",
        sourceNode: e.target.dataset.nodeid,
        sourceHandle: e.target.dataset.handleid,
        startX: pos.x,
        startY: pos.y,
        currX: pos.x,
        currY: pos.y
      })
      return
    }

    // ノードのクリック処理
    const nodeEl = e.target.closest(".node-element")
    if (nodeEl) {
      e.stopPropagation()
      const nodeId = nodeEl.dataset.id
      setSelectedNodeId(nodeId)

      // ボタン等の入力要素でなければドラッグ開始
      if (
        !["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        setInteraction({
          type: "drag_node",
          nodeId: nodeId,
          startX: e.clientX,
          startY: e.clientY,
          initialNodes: nodes
        })
      }
      return
    }

    // 背景クリックでパン開始＆選択解除
    setSelectedNodeId(null)
    setInteraction({
      type: "pan",
      startX: e.clientX,
      startY: e.clientY,
      initTx: transform.x,
      initTy: transform.y
    })
  }

  const onMouseMove = e => {
    if (interaction.type === "pan") {
      const dx = e.clientX - interaction.startX
      const dy = e.clientY - interaction.startY
      setTransform(prev => ({
        ...prev,
        x: interaction.initTx + dx,
        y: interaction.initTy + dy
      }))
    } else if (interaction.type === "drag_node") {
      const dx = (e.clientX - interaction.startX) / transform.scale
      const dy = (e.clientY - interaction.startY) / transform.scale
      setNodes(
        interaction.initialNodes.map(n =>
          n.id === interaction.nodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n
        )
      )
    } else if (interaction.type === "draw_edge") {
      const pos = getLogicalPosition(e.clientX, e.clientY)
      setInteraction(prev => ({ ...prev, currX: pos.x, currY: pos.y }))
    }
  }

  const onMouseUp = e => {
    if (interaction.type === "draw_edge") {
      const targetPort = e.target.closest('[data-port="in"]')
      if (targetPort) {
        const targetNode = targetPort.dataset.nodeid
        // 自分自身への接続と、既に同じ接続がある場合は無視
        if (
          targetNode !== interaction.sourceNode &&
          !edges.find(
            edge =>
              edge.source === interaction.sourceNode &&
              edge.sourceHandle === interaction.sourceHandle &&
              edge.target === targetNode
          )
        ) {
          setEdges(prev => [
            ...prev,
            {
              id: generateId("e"),
              source: interaction.sourceNode,
              sourceHandle: interaction.sourceHandle,
              target: targetNode
            }
          ])
        }
      }
    }
    setInteraction({ type: "none" })
  }

  // --- ノード操作 ---
  const addNode = type => {
    const pos = getLogicalPosition(
      window.innerWidth / 2,
      window.innerHeight / 2
    )
    const newNode = {
      ...DEFAULT_NODE,
      id: generateId("n"),
      type,
      x: pos.x,
      y: pos.y
    }
    if (type === "normal") newNode.text = "新規テキスト"
    if (type === "probability")
      newNode.branches = [
        { id: generateId("b"), weight: 5 },
        { id: generateId("b"), weight: 5 }
      ]
    setNodes(prev => [...prev, newNode])
    setSelectedNodeId(newNode.id)
  }

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return
    setNodes(nodes.filter(n => n.id !== selectedNodeId))
    setEdges(
      edges.filter(
        e => e.source !== selectedNodeId && e.target !== selectedNodeId
      )
    )
    setSelectedNodeId(null)
  }

  const updateNode = (id, data) => {
    setNodes(nodes.map(n => (n.id === id ? { ...n, ...data } : n)))
  }

  const deleteEdge = id => {
    setEdges(edges.filter(e => e.id !== id))
  }

  // --- JSON エクスポート/インポート ---
  const exportJSON = () => {
    // エディタの構造からGameMaker用スキーマへ変換
    const exportNodes = nodes.map(n => {
      const nodeExport = { ...n }
      delete nodeExport.type // 内部管理用プロパティを消すかは任意だが、読み込み再開用に残しておく方が便利

      // エッジからgoto情報を構築
      const outgoingEdges = edges.filter(e => e.source === n.id)

      if (n.type === "normal" || n.type === "start") {
        if (n.choices && n.choices.length > 0) {
          nodeExport.choices = n.choices.map(c => {
            const edge = outgoingEdges.find(e => e.sourceHandle === c.id)
            return { ...c, goto: edge ? edge.target : null }
          })
        } else {
          const edge = outgoingEdges[0]
          if (edge) nodeExport.goto = edge.target // スキーマには明示されてないが通常遷移用
        }
      } else if (n.type === "condition") {
        nodeExport.condition_match_type = n.condition_match_type || "AND"
        nodeExport.conditions = n.conditions.map(cond => {
          const edge = outgoingEdges.find(e => e.sourceHandle === cond.id)
          return { ...cond, goto: edge ? edge.target : null }
        })
        const defaultEdge = outgoingEdges.find(
          e => e.sourceHandle === "default"
        )
        nodeExport.default_goto = defaultEdge ? defaultEdge.target : null
      } else if (n.type === "probability") {
        nodeExport.branches = n.branches.map(b => {
          const edge = outgoingEdges.find(e => e.sourceHandle === b.id)
          return { ...b, goto: edge ? edge.target : null }
        })
      }
      return nodeExport
    })

    const startNode = nodes.find(n => n.type === "start")

    const json = {
      meta: {
        project_name: "Dialogue Project",
        version: "1.0",
        generated_at: new Date().toISOString()
      },
      assets: { portraits: [], icons: [] }, // プロトタイプではアセットパネルは簡略化
      nodes: exportNodes,
      start_node: startNode ? startNode.id : null,
      editor_data: { edges } // 再読み込み用にエッジ情報も保持
    }

    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "dialogue_data.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJSON = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result)
        setNodes(data.nodes || [])
        if (data.editor_data && data.editor_data.edges) {
          setEdges(data.editor_data.edges)
        } else {
          // edge再構築ロジックが必要だが、プロトタイプなので簡易化
          alert(
            "エッジ情報がないファイルです。エディタ専用形式でのみ完全復元可能です。"
          )
        }
      } catch (err) {
        alert("JSONの読み込みに失敗しました。")
      }
    }
    reader.readAsText(file)
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  // ==========================================
  // レンダリング
  // ==========================================
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* ツールバー */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <MessageSquare size={20} /> Dialogue Flow Editor
          </div>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <button
            onClick={() => addNode("normal")}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
          >
            <Plus size={16} /> 通常ブロック
          </button>
          <button
            onClick={() => addNode("condition")}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
          >
            <AlertTriangle size={16} /> 条件ブロック
          </button>
          <button
            onClick={() => addNode("probability")}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
          >
            <Dices size={16} /> 確率ブロック
          </button>
          <button
            onClick={() => addNode("end")}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors text-red-400"
          >
            <XCircle size={16} /> 終了ブロック
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow transition-colors"
          >
            <Play size={16} /> プレビュー
          </button>
          <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 cursor-pointer rounded text-sm transition-colors">
            <Upload size={16} /> インポート
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importJSON}
            />
          </label>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
          >
            <Download size={16} /> エクスポート
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* キャンバス領域 */}
        <div
          ref={canvasRef}
          className="flex-1 bg-slate-950 relative overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: "radial-gradient(#334155 1px, transparent 1px)",
            backgroundSize: `${20 * transform.scale}px ${20 *
              transform.scale}px`,
            backgroundPosition: `${transform.x}px ${transform.y}px`
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* ノードとエッジを描画するレイヤー */}
          <div
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              width: 0,
              height: 0
            }}
          >
            {/* エッジ（やじるし）描画用SVG */}
            <svg className="absolute top-0 left-0 overflow-visible pointer-events-none">
              {edges.map(edge => {
                // 接続点の座標計算（DOMから取得するのが確実だが、今回は座標から近似計算）
                const sourceNode = nodes.find(n => n.id === edge.source)
                const targetNode = nodes.find(n => n.id === edge.target)
                if (!sourceNode || !targetNode) return null

                // ノード幅（固定値と仮定）からのオフセット
                const nodeWidth =
                  sourceNode.type === "start" || sourceNode.type === "end"
                    ? 64
                    : 256
                const sx = sourceNode.x + nodeWidth
                let sy = sourceNode.y + 24 // デフォルトの高さ

                // ポートのY座標調整
                if (
                  sourceNode.type === "normal" &&
                  sourceNode.choices &&
                  sourceNode.choices.length > 0
                ) {
                  const idx = sourceNode.choices.findIndex(
                    c => c.id === edge.sourceHandle
                  )
                  sy = sourceNode.y + 110 + idx * 34 // 選択肢行の高さ概算
                } else if (sourceNode.type === "condition") {
                  const idx = sourceNode.conditions.findIndex(
                    c => c.id === edge.sourceHandle
                  )
                  sy =
                    sourceNode.y +
                    90 +
                    (idx !== -1 ? idx : sourceNode.conditions.length) * 40
                } else if (sourceNode.type === "probability") {
                  const idx = sourceNode.branches.findIndex(
                    b => b.id === edge.sourceHandle
                  )
                  sy = sourceNode.y + 60 + idx * 36
                }

                const tx = targetNode.x
                const ty =
                  targetNode.y +
                  (targetNode.type === "start" || targetNode.type === "end"
                    ? 32
                    : 24)

                // ベジェ曲線のパス生成
                const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx -
                  50} ${ty}, ${tx} ${ty}`

                return (
                  <g
                    key={edge.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => deleteEdge(edge.id)}
                  >
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="15"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      markerEnd="url(#arrowhead)"
                      className="hover:stroke-red-500 transition-colors"
                    />
                  </g>
                )
              })}

              {/* ドラッグ中のエッジ */}
              {interaction.type === "draw_edge" && (
                <path
                  d={`M ${interaction.startX} ${
                    interaction.startY
                  } C ${interaction.startX + 50} ${
                    interaction.startY
                  }, ${interaction.currX - 50} ${interaction.currY}, ${
                    interaction.currX
                  } ${interaction.currY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
              </defs>
            </svg>

            {/* ノード群 */}
            {nodes.map(node => (
              <NodeComponent
                key={node.id}
                node={node}
                isSelected={node.id === selectedNodeId}
              />
            ))}
          </div>

          {/* 操作ヒント */}
          <div className="absolute bottom-4 left-4 text-slate-500 text-xs flex flex-col gap-1 pointer-events-none">
            <span>左ドラッグ: 画面移動 / ノード移動</span>
            <span>ポート(○)ドラッグ: 矢印を作成</span>
            <span>矢印クリック: 接続を削除</span>
          </div>
        </div>

        {/* インスペクタ領域 */}
        {selectedNodeId && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900/90 backdrop-blur z-10">
              <span className="font-semibold text-sm">
                プロパティ: {selectedNode.type}
              </span>
              <button
                onClick={deleteSelectedNode}
                className="p-1.5 text-red-400 hover:bg-red-400/20 rounded transition-colors"
                title="ノードを削除"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4 text-sm">
              {/* 共通: メモ */}
              <div>
                <label className="block text-slate-400 mb-1 text-xs">
                  ノードID (読取専用)
                </label>
                <input
                  type="text"
                  value={selectedNode.id}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-500 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 text-xs">
                  メモ
                </label>
                <input
                  type="text"
                  value={selectedNode.notes || ""}
                  onChange={e =>
                    updateNode(selectedNode.id, { notes: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 focus:border-indigo-500 outline-none"
                  placeholder="メモを入力..."
                />
              </div>

              {/* 通常ブロック用 */}
              {selectedNode.type === "normal" && (
                <>
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 mb-1 text-xs">
                      話者名 (Speaker)
                    </label>
                    <input
                      type="text"
                      value={selectedNode.speaker || ""}
                      onChange={e =>
                        updateNode(selectedNode.id, { speaker: e.target.value })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-400 mb-1 text-xs">
                        立ち絵 ID
                      </label>
                      <input
                        type="text"
                        value={selectedNode.portrait || ""}
                        onChange={e =>
                          updateNode(selectedNode.id, {
                            portrait: e.target.value
                          })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none"
                        placeholder="p_npcA"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-400 mb-1 text-xs">
                        アイコン
                      </label>
                      <select
                        value={selectedNode.emotion_icon || ""}
                        onChange={e =>
                          updateNode(selectedNode.id, {
                            emotion_icon: e.target.value
                          })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none"
                      >
                        <option value="">なし</option>
                        <option value="💡">💡 閃き</option>
                        <option value="！">！ 驚き</option>
                        <option value="？">？ 疑問</option>
                        <option value="💧">💧 汗</option>
                        <option value="怒">💢 怒り</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-xs">
                      テキスト内容
                    </label>
                    <textarea
                      rows={5}
                      value={selectedNode.text || ""}
                      onChange={e =>
                        updateNode(selectedNode.id, { text: e.target.value })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 focus:border-indigo-500 outline-none resize-none"
                      placeholder="セリフを入力..."
                    ></textarea>
                  </div>

                  <div className="pt-2 border-t border-slate-800 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-slate-400 text-xs">
                        選択肢 (オプション)
                      </label>
                      <button
                        onClick={() =>
                          updateNode(selectedNode.id, {
                            choices: [
                              ...(selectedNode.choices || []),
                              { id: generateId("c"), text: "新規選択肢" }
                            ]
                          })
                        }
                        className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                      >
                        追加
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(selectedNode.choices || []).map((choice, i) => (
                        <div
                          key={choice.id}
                          className="bg-slate-950 p-2 rounded border border-slate-800"
                        >
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={choice.text}
                              onChange={e => {
                                const newChoices = [...selectedNode.choices]
                                newChoices[i].text = e.target.value
                                updateNode(selectedNode.id, {
                                  choices: newChoices
                                })
                              }}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded p-1 text-xs outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => {
                                updateNode(selectedNode.id, {
                                  choices: selectedNode.choices.filter(
                                    c => c.id !== choice.id
                                  )
                                })
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 確率ブロック用 */}
              {selectedNode.type === "probability" && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-slate-400 text-xs">
                      分岐ごとの重み
                    </label>
                    <button
                      onClick={() =>
                        updateNode(selectedNode.id, {
                          branches: [
                            ...(selectedNode.branches || []),
                            { id: generateId("b"), weight: 1 }
                          ]
                        })
                      }
                      className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                    >
                      追加
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(selectedNode.branches || []).map((branch, i) => (
                      <div
                        key={branch.id}
                        className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-slate-400 w-12">
                          分岐 {i + 1}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={branch.weight}
                          onChange={e => {
                            const newBranches = [...selectedNode.branches]
                            newBranches[i].weight = Number(e.target.value)
                            updateNode(selectedNode.id, {
                              branches: newBranches
                            })
                          }}
                          className="w-16 bg-slate-800 border border-slate-700 rounded p-1 text-xs outline-none focus:border-indigo-500 text-right"
                        />
                        <button
                          onClick={() => {
                            updateNode(selectedNode.id, {
                              branches: selectedNode.branches.filter(
                                b => b.id !== branch.id
                              )
                            })
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="mt-2 text-xs text-slate-500 text-right">
                      合計:{" "}
                      {(selectedNode.branches || []).reduce(
                        (sum, b) => sum + Number(b.weight || 0),
                        0
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 条件ブロック用 */}
              {selectedNode.type === "condition" && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-slate-400 text-xs">結合条件:</label>
                    <select
                      value={selectedNode.condition_match_type || "AND"}
                      onChange={e =>
                        updateNode(selectedNode.id, {
                          condition_match_type: e.target.value
                        })
                      }
                      className="bg-slate-800 border border-slate-700 rounded p-1 text-xs outline-none"
                    >
                      <option value="AND">すべて満たす (AND)</option>
                      <option value="OR">いずれかを満たす (OR)</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-slate-400 text-xs">
                      分岐条件
                    </label>
                    <button
                      onClick={() =>
                        updateNode(selectedNode.id, {
                          conditions: [
                            ...(selectedNode.conditions || []),
                            {
                              id: `cond_${Date.now()}`,
                              type: "tf",
                              key: "flag",
                              op: "==",
                              value: "true"
                            }
                          ]
                        })
                      }
                      className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                    >
                      追加
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(selectedNode.conditions || []).map((cond, i) => (
                      <div
                        key={cond.id}
                        className="bg-slate-950 p-2 rounded border border-slate-800 text-xs flex flex-col gap-1 relative group"
                      >
                        <div className="flex justify-between">
                          <select
                            value={cond.type}
                            onChange={e => {
                              const newConds = [...selectedNode.conditions]
                              newConds[i].type = e.target.value
                              newConds[i].op = "==" // 型変更時に演算子をリセット
                              updateNode(selectedNode.id, {
                                conditions: newConds
                              })
                            }}
                            className="bg-slate-800 p-1 rounded outline-none w-16 text-xs"
                          >
                            <option value="tf">TF型</option>
                            <option value="number">数値型</option>
                            <option value="string">E型</option>
                          </select>
                          <button
                            onClick={() =>
                              updateNode(selectedNode.id, {
                                conditions: selectedNode.conditions.filter(
                                  c => c.id !== cond.id
                                )
                              })
                            }
                            className="text-red-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex gap-1 items-center mt-1">
                          <input
                            type="text"
                            value={cond.key}
                            onChange={e => {
                              const newConds = [...selectedNode.conditions]
                              newConds[i].key = e.target.value
                              updateNode(selectedNode.id, {
                                conditions: newConds
                              })
                            }}
                            className="flex-1 bg-slate-800 p-1 rounded outline-none w-0"
                            placeholder="変数/フラグ名"
                          />

                          <select
                            value={cond.op}
                            onChange={e => {
                              const newConds = [...selectedNode.conditions]
                              newConds[i].op = e.target.value
                              updateNode(selectedNode.id, {
                                conditions: newConds
                              })
                            }}
                            className="bg-slate-800 p-1 rounded outline-none w-10 text-center"
                          >
                            {cond.type === "tf" || cond.type === "string" ? (
                              <>
                                <option>==</option>
                                <option>!=</option>
                              </>
                            ) : (
                              <>
                                <option>==</option>
                                <option>!=</option>
                                <option>&gt;</option>
                                <option>&lt;</option>
                                <option>&gt;=</option>
                                <option>&lt;=</option>
                              </>
                            )}
                          </select>

                          {cond.type === "tf" ? (
                            <select
                              value={cond.value}
                              onChange={e => {
                                const newConds = [...selectedNode.conditions]
                                newConds[i].value = e.target.value
                                updateNode(selectedNode.id, {
                                  conditions: newConds
                                })
                              }}
                              className="flex-1 bg-slate-800 p-1 rounded outline-none w-0"
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={cond.value}
                              onChange={e => {
                                const newConds = [...selectedNode.conditions]
                                newConds[i].value = e.target.value
                                updateNode(selectedNode.id, {
                                  conditions: newConds
                                })
                              }}
                              className="flex-1 bg-slate-800 p-1 rounded outline-none w-0"
                              placeholder={
                                cond.type === "number" ? "数値" : "文字列"
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* プレビューモーダル */}
      {previewMode && (
        <PreviewModal
          nodes={nodes}
          edges={edges}
          onClose={() => setPreviewMode(false)}
        />
      )}
    </div>
  )
}

// ==========================================
// ノードコンポーネント (種類ごとに見た目を変更)
// ==========================================
const NodeComponent = ({ node, isSelected }) => {
  const isCircle = node.type === "start" || node.type === "end"

  let content = null

  if (node.type === "start") {
    content = (
      <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-sm shadow-lg border-2 border-indigo-400 font-bold">
        START
      </div>
    )
  } else if (node.type === "end") {
    content = (
      <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-sm shadow-lg border-2 border-slate-500 font-bold">
        END
      </div>
    )
  } else if (node.type === "normal") {
    const bgColor = getSpeakerColor(node.speaker)
    content = (
      <div
        className={`w-64 bg-slate-800 rounded-lg shadow-xl border-2 flex flex-col overflow-hidden ${
          isSelected ? "border-indigo-400" : "border-slate-700"
        }`}
      >
        <div
          className={`px-3 py-1.5 flex justify-between items-center border-b ${bgColor}`}
        >
          <span className="font-bold text-xs truncate drop-shadow-md">
            {node.speaker || "No Name"}
          </span>
          {node.emotion_icon && (
            <span className="bg-slate-900/50 rounded px-1.5 py-0.5 text-xs">
              {node.emotion_icon}
            </span>
          )}
        </div>
        {node.notes && (
          <div className="px-3 py-1 bg-slate-900/50 text-[10px] text-slate-400 border-b border-slate-700/50 truncate">
            🗒 {node.notes}
          </div>
        )}
        <div className="p-3 text-sm min-h-[60px] line-clamp-3 text-slate-300">
          {node.text || (
            <span className="text-slate-600 italic">テキストなし...</span>
          )}
        </div>
        {node.choices && node.choices.length > 0 && (
          <div className="bg-slate-900 border-t border-slate-700 flex flex-col gap-1 p-2">
            {node.choices.map((c, i) => (
              <div
                key={c.id}
                className="bg-slate-800 p-1.5 rounded text-xs border border-slate-700 relative flex justify-between items-center group"
              >
                <span className="truncate pr-4">{c.text}</span>
                <div
                  data-port="out"
                  data-nodeid={node.id}
                  data-handleid={c.id}
                  className="absolute -right-3 w-4 h-4 bg-indigo-400 border-2 border-slate-900 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  } else if (node.type === "probability") {
    const totalWeight = (node.branches || []).reduce(
      (sum, b) => sum + (Number(b.weight) || 0),
      0
    )
    content = (
      <div
        className={`w-64 bg-slate-800 rounded-lg shadow-xl border-2 flex flex-col overflow-hidden ${
          isSelected ? "border-pink-400" : "border-slate-700"
        }`}
      >
        <div className="px-3 py-1.5 bg-pink-900 border-b border-pink-700 font-bold text-xs flex items-center gap-1">
          <Dices size={14} /> 確率分岐
        </div>
        <div className="p-2 flex flex-col gap-1">
          {node.branches &&
            node.branches.map((b, i) => {
              const w = Number(b.weight) || 0
              const prob =
                totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0
              return (
                <div
                  key={b.id}
                  className="bg-slate-900 p-1.5 rounded text-xs border border-slate-700 relative flex justify-between items-center group"
                >
                  <span>
                    分岐 {i + 1} (比 {w})
                  </span>
                  <span className="text-pink-400 font-mono">{prob}%</span>
                  <div
                    data-port="out"
                    data-nodeid={node.id}
                    data-handleid={b.id}
                    className="absolute -right-3 w-4 h-4 bg-pink-400 border-2 border-slate-900 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
                  ></div>
                </div>
              )
            })}
        </div>
      </div>
    )
  } else if (node.type === "condition") {
    content = (
      <div
        className={`w-64 bg-slate-800 rounded-lg shadow-xl border-2 flex flex-col overflow-hidden ${
          isSelected ? "border-amber-400" : "border-slate-700"
        }`}
      >
        <div className="px-3 py-1.5 bg-amber-900 border-b border-amber-700 font-bold text-xs flex items-center justify-between">
          <div className="flex items-center gap-1">
            <AlertTriangle size={14} /> 条件分岐
          </div>
          <div className="text-[10px] bg-slate-900/50 px-1 rounded">
            {node.condition_match_type || "AND"}
          </div>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {node.conditions &&
            node.conditions.map((c, i) => (
              <div
                key={c.id}
                className="bg-slate-900 p-1.5 rounded text-xs border border-slate-700 relative flex gap-1 items-center group overflow-hidden"
              >
                <span className="text-[10px] text-slate-500 w-4">
                  {c.type === "tf" ? "TF" : c.type === "number" ? "#" : "E"}
                </span>
                <span className="text-amber-400 font-mono truncate max-w-[60px]">
                  {c.key}
                </span>
                <span className="text-slate-300">{c.op}</span>
                <span className="text-emerald-400 font-mono truncate">
                  {c.value}
                </span>
                <div
                  data-port="out"
                  data-nodeid={node.id}
                  data-handleid={c.id}
                  className="absolute -right-3 w-4 h-4 bg-amber-400 border-2 border-slate-900 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>
              </div>
            ))}
          <div className="bg-slate-900/50 p-1.5 rounded text-xs border border-slate-800 relative text-slate-500 text-center group mt-1">
            その他 (else)
            <div
              data-port="out"
              data-nodeid={node.id}
              data-handleid="default"
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-500 border-2 border-slate-900 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity"
            ></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute node-element group"
      data-id={node.id}
      style={{ left: node.x, top: node.y }}
    >
      {/* 選択時のアウトライン（光彩エフェクト） */}
      {isSelected && (
        <div
          className={`absolute -inset-1 rounded-${
            isCircle ? "full" : "xl"
          } bg-white/20 blur-sm pointer-events-none`}
        ></div>
      )}

      {content}

      {/* 共通の入力ポート (START以外) */}
      {node.type !== "start" && (
        <div
          data-port="in"
          data-nodeid={node.id}
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full cursor-crosshair hover:scale-150 transition-transform"
        ></div>
      )}

      {/* 共通の出力ポート (通常ブロックの選択肢なしの場合 または START) */}
      {(node.type === "start" ||
        (node.type === "normal" &&
          (!node.choices || node.choices.length === 0))) && (
        <div
          data-port="out"
          data-nodeid={node.id}
          data-handleid="out"
          className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-400 border-2 border-slate-900 rounded-full cursor-crosshair hover:scale-150 transition-transform"
        ></div>
      )}
    </div>
  )
}

// ==========================================
// 簡易プレビューシミュレータ
// ==========================================
const PreviewModal = ({ nodes, edges, onClose }) => {
  const startNode = nodes.find(n => n.type === "start")
  const [currentNodeId, setCurrentNodeId] = useState(
    startNode ? startNode.id : null
  )
  const [history, setHistory] = useState([]) // ログ表示用

  // シミュレーション実行ロジック
  const getNextNode = (nodeId, handleId = "out") => {
    const edge = edges.find(
      e =>
        e.source === nodeId &&
        (e.sourceHandle === handleId || e.sourceHandle === "out")
    )
    return edge ? edge.target : null
  }

  const advanceNode = (handleId = "out") => {
    const nextId = getNextNode(currentNodeId, handleId)
    if (nextId) setCurrentNodeId(nextId)
  }

  const currentNode = nodes.find(n => n.id === currentNodeId)

  // 自動的に通常ノード・開始ノード等を処理（選択肢や条件で止める）
  useEffect(() => {
    if (!currentNode) return

    // ログ記録
    setHistory(prev => [...prev, { id: Date.now(), node: currentNode }])

    if (currentNode.type === "start") {
      setTimeout(() => advanceNode(), 500)
    } else if (currentNode.type === "condition") {
      // プロトタイプのためフラグ評価は省略、デフォルトまたは最初の条件へ進む擬似処理
      setTimeout(() => {
        const firstCond =
          currentNode.conditions && currentNode.conditions.length > 0
            ? currentNode.conditions[0].id
            : "default"
        advanceNode(firstCond)
      }, 800)
    } else if (currentNode.type === "probability") {
      // 確率に基づく抽選シミュレーション
      setTimeout(() => {
        if (!currentNode.branches || currentNode.branches.length === 0) return
        const totalWeight = currentNode.branches.reduce(
          (sum, b) => sum + (Number(b.weight) || 0),
          0
        )
        if (totalWeight <= 0) return

        let r = Math.random() * totalWeight
        let selectedId = currentNode.branches[0].id
        for (const b of currentNode.branches) {
          if (r < Number(b.weight)) {
            selectedId = b.id
            break
          }
          r -= Number(b.weight)
        }
        advanceNode(selectedId)
      }, 1000)
    }
  }, [currentNodeId])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center font-sans">
      <div className="w-[800px] h-[600px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* ヘッダ */}
        <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950">
          <span className="font-bold flex items-center gap-2 text-indigo-400">
            <PlayCircle size={18} /> プレビュー
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle size={20} />
          </button>
        </div>

        {/* 画面 */}
        <div className="flex-1 p-6 flex flex-col justify-end bg-black relative">
          {/* 背景画像などの代わりにダミー */}
          <div className="absolute inset-0 bg-slate-800/20 grid place-items-center opacity-50">
            <div className="text-slate-700 text-6xl font-bold">GAME SCREEN</div>
          </div>

          {!currentNode && (
            <div className="relative z-10 text-center text-red-400 bg-red-900/50 p-4 rounded-xl border border-red-700">
              ノードが見つかりません。STARTノードが正しく接続されているか確認してください。
            </div>
          )}

          {/* 会話UI枠 / 選択肢枠 */}
          {currentNode && currentNode.type === "normal" && (
            <div className="relative z-10 flex flex-col gap-4 w-full max-w-2xl mx-auto">
              <div className="bg-slate-900/95 border-2 border-slate-600 rounded-xl p-4 shadow-2xl relative">
                <div className="absolute -top-4 left-4 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg border-2 border-indigo-800 flex items-center gap-2">
                  {currentNode.speaker || "???"}
                  {currentNode.emotion_icon && (
                    <span>{currentNode.emotion_icon}</span>
                  )}
                </div>
                <div className="text-lg text-slate-200 mt-3 min-h-[80px] leading-relaxed">
                  {currentNode.text}
                </div>
                {(!currentNode.choices || currentNode.choices.length === 0) && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => advanceNode("out")}
                      className="text-indigo-400 hover:text-indigo-300 animate-pulse flex items-center gap-1 text-sm"
                    >
                      ▼ 次へ (Click)
                    </button>
                  </div>
                )}
              </div>

              {currentNode.choices && currentNode.choices.length > 0 && (
                <div className="flex flex-col gap-3 self-end w-full max-w-md">
                  {currentNode.choices.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => advanceNode(c.id)}
                      className="bg-slate-800/90 border-2 border-slate-600 hover:border-indigo-400 hover:bg-slate-700 p-4 rounded-xl text-left text-lg transition-all shadow-lg text-slate-200"
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 確率抽選中表示 */}
          {currentNode && currentNode.type === "probability" && (
            <div className="relative z-10 text-center flex flex-col items-center">
              <span className="text-2xl font-bold text-pink-400 mb-4 animate-bounce">
                🎲 確率抽選中...
              </span>
            </div>
          )}

          {/* 終了画面 */}
          {currentNode && currentNode.type === "end" && (
            <div className="relative z-10 text-center flex flex-col items-center">
              <span className="text-2xl font-bold text-slate-400 mb-4 tracking-widest">
                - END -
              </span>
              <button
                onClick={() => setCurrentNodeId(startNode?.id)}
                className="bg-indigo-600 px-6 py-2 rounded-full hover:bg-indigo-500 transition-colors shadow-lg"
              >
                もう一度最初から
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
