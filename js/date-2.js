
// 設定開始（指定日の年月日を設定してください）

var y = new Date().getFullYear(); // 年
var m = new Date().getMonth() + 1; // 月
var d = 31; // 日

// 設定終了


var tgday = y + "/" + m + "/" + d;

var now = new Date();

var days = Math.ceil((Date.parse(tgday) - now.getTime()) / (24 * 60 * 60 * 1000));

// 表示開始
if(days == 0) {

	document.write('今月も終わり'); // 指定日当日の表示

}
else if(days < 0) {

	days = Math.abs(days);
	document.write('先月から <b>' + days + '</b> 日が過ぎました。'); // 指定日後の表示

}
else {

	document.write('今月は残り <b>' + days + '</b> 日です。'); // 指定日前の表示

}
// 表示終了
