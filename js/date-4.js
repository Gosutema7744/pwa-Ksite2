// 設定開始（指定日の年月日を設定してください）

var y = 2023; // 年
var m = 11; // 月
var d = 6; // 日

// 設定終了


var tgday = y + "/" + m + "/" + d;

var now = new Date();

var days = Math.ceil((Date.parse(tgday) - now.getTime()) / (24 * 60 * 60 * 1000));

// 表示開始
if(days == 0) {

	document.write('🔥🔥！駅伝！🔥🔥'); // 指定日当日の表示

}
else if(days < 0) {

	

}
else {

	document.write('⭐️駅伝まで残り  <b>' + days + '</b>   日！！⭐️'); // 指定日前の表示

}
// 表示終了
