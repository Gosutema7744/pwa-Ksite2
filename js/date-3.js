// 設定開始（指定日の年月日を設定してください）

var y = 2023; // 年
var m = 10; // 月
var d = 2; // 日

// 設定終了


var tgday = y + "/" + m + "/" + d;

var now = new Date();

var days = Math.ceil((Date.parse(tgday) - now.getTime()) / (24 * 60 * 60 * 1000));

// 表示開始
if(days == 0) {

	document.write('定期テスト開始！'); // 指定日当日の表示

}
else if(days < 0) {

	if(days < -5) {

	}
	else{
	days = Math.abs(days);
	document.write('定期テスト  <b>' + days + '</b>  日目'); // 指定日後の表示

	}

}
else {

	document.write('  定期テストまで  <b>' + days + '</b>  日'); // 指定日前の表示

}
// 表示終了
