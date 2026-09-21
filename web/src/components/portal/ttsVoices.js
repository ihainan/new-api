/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/*
 * cosy-voice 可用音色的快照，来自音色演示页 https://zgcai-tts-voices.web.zgci.org/
 * （2026-09-21 抓取，203 个）。音色库在后端可以随时增加，这里只是快照——
 * 以演示页为准，那边还能直接试听。
 *
 * 为什么不实时拉：列音色的接口 GET /v1/voices 在 bridge 上，网关不转发，
 * 门户这边拿不到。
 *
 * 2026-09-21 实测：每个分组各抽一个音色走网关合成，19 个分组全部 200；
 * 不存在的名字返回 400「not found in the library」。
 */
export const VOICE_DEMO_URL = 'https://zgcai-tts-voices.web.zgci.org/';

export const VOICE_GROUPS = [
  {
    tab: '普通话',
    group: '女声',
    voices: [
      ['vc_zh_female_yingyujiaoxue', 'Tina老师 2.0'],
      ['vc_zh_female_vv', 'Vivi 2.0'],
      ['vc_zh_female_qinqienv', '亲切女声 2.0'],
      ['vc_zh_female_peiqi', '佩奇猪 2.0'],
      ['vc_zh_female_qiaopinv', '俏皮女声 2.0'],
      ['mm_qiaopi_mengmei', '俏皮萌妹'],
      ['mm_Mature_Woman', '傲娇御姐'],
      ['vc_zh_female_xiaoxue', '儿童绘本 2.0'],
      ['vc_zh_female_gufengshaoyu', '古风少御 2.0'],
      ['mm_diadia_xuemei', '嗲嗲学妹'],
      ['vc_zh_female_nvleishen', '女雷神 2.0'],
      ['vc_zh_female_jiaochuannv', '娇喘女声 2.0'],
      ['vc_zh_female_popo', '婆婆 2.0'],
      ['vc_zh_female_xiaohe', '小何 2.0'],
      ['vc_zh_female_shaoergushi', '少儿故事 2.0'],
      ['mm_female-shaonv', '少女音色'],
      ['mm_female-shaonv-jingpin', '少女音色-beta'],
      ['vc_zh_female_kailangjiejie', '开朗姐姐 2.0'],
      ['mm_female-yujie', '御姐音色'],
      ['mm_female-yujie-jingpin', '御姐音色-beta'],
      ['vc_zh_female_xinlingjitang', '心灵鸡汤 2.0'],
      ['vc_zh_female_ganmaodianyin', '感冒电音姐姐 2.0'],
      ['mm_female-chengshu', '成熟女性音色'],
      ['mm_female-chengshu-jingpin', '成熟女性音色-beta'],
      ['vc_zh_female_sajiaoxuemei', '撒娇学妹 2.0'],
      ['vc_zh_female_wenjingmaomao', '文静毛毛 2.0'],
      ['mm_News_Anchor', '新闻女声'],
      ['vc_zh_female_chunribu', '春日部姐姐 2.0'],
      ['vc_zh_female_kefunvsheng', '暖阳女声 2.0'],
      ['vc_zh_female_linxiao', '林潇 2.0'],
      ['vc_zh_female_roumeinvyou', '柔美女友 2.0'],
      ['vc_zh_female_yingtaowanzi', '樱桃丸子 2.0'],
      ['vc_zh_female_wuzetian', '武则天 2.0'],
      ['vc_zh_female_liuchangnv', '流畅女声 2.0'],
      ['vc_zh_female_qingxinnvsheng', '清新女声 2.0'],
      ['vc_zh_female_qingchezizi', '清澈梓梓 2.0'],
      ['mm_Crisp_Girl', '清脆少女'],
      ['mm_Warm_Girl', '温暖少女'],
      ['mm_Warm_Bestie', '温暖闺蜜'],
      ['vc_zh_female_wenroumama', '温柔妈妈 2.0'],
      ['mm_Gentle_Senior', '温柔学姐'],
      ['vc_zh_female_wenrouxiaoya', '温柔小雅 2.0'],
      ['vc_zh_female_wenroushunv', '温柔淑女 2.0'],
      ['mm_Kind-hearted_Antie', '热心大婶'],
      ['vc_zh_female_shuangkuaisisi', '爽快思思 2.0'],
      ['vc_zh_female_lingling', '玲玲姐姐 2.0'],
      ['mm_tianxin_xiaoling', '甜心小玲'],
      ['mm_Sweet_Lady', '甜美女声'],
      ['mm_female-tianmei', '甜美女性音色'],
      ['mm_female-tianmei-jingpin', '甜美女性音色-beta'],
      ['vc_zh_female_tianmeixiaoyuan', '甜美小源 2.0'],
      ['vc_zh_female_tianmeiyueyue', '甜美悦悦 2.0'],
      ['vc_zh_female_tianmeitaozi', '甜美桃子 2.0'],
      ['vc_zh_female_zhishuaiyingzi', '直率英子 2.0'],
      ['vc_zh_female_zhixingnv', '知性女声 2.0'],
      ['vc_zh_female_cancan', '知性灿灿 2.0'],
      ['mm_Kind-hearted_Elder', '花甲奶奶'],
      ['vc_zh_female_mengyatou', '萌丫头/Cutey 2.0'],
      ['mm_lovely_girl', '萌萌女童'],
      ['vc_zh_female_chanmeinv', '谄媚女声 2.0'],
      ['vc_zh_female_tiexinnvsheng', '贴心女声/Candy 2.0'],
      ['mm_Soft_Girl', '软软女孩'],
      ['vc_zh_female_linjianvhai', '邻家女孩 2.0'],
      ['mm_Wise_Women', '阅历姐姐'],
      ['vc_zh_female_gujie', '顾姐 2.0'],
      ['vc_zh_female_gaolengyujie', '高冷御姐 2.0'],
      ['vc_zh_female_meilinvyou', '魅力女友 2.0'],
      ['vc_zh_female_sophie', '魅力苏菲 2.0'],
      ['vc_zh_female_jitangnv', '鸡汤女 2.0'],
      ['vc_zh_female_jitangmei', '鸡汤妹妹/Hope 2.0'],
      ['vc_zh_female_mizai', '黑猫侦探社咪仔 2.0'],
    ],
  },
  {
    tab: '普通话',
    group: '男声',
    voices: [
      ['mm_Unrestrained_Young_Man', '不羁青年'],
      ['vc_zh_male_dongfanghaoran', '东方浩然 2.0'],
      ['vc_zh_male_m191', '云舟 2.0'],
      ['vc_zh_male_liangsangmengzai', '亮嗓萌仔 2.0'],
      ['mm_junlang_nanyou', '俊朗男友'],
      ['vc_zh_male_aojiaobazong', '傲娇霸总 2.0'],
      ['vc_zh_male_ruyayichen', '儒雅逸辰 2.0'],
      ['vc_zh_male_ruyaqingnian', '儒雅青年 2.0'],
      ['vc_zh_male_liufei', '刘飞 2.0'],
      ['mm_Southern_Young_Man', '南方小哥'],
      ['vc_zh_male_fanjuanqingnian', '反卷青年 2.0'],
      ['mm_cute_boy', '可爱男童'],
      ['vc_zh_male_tangseng', '唐僧 2.0'],
      ['mm_Stubborn_Friend', '嘴硬竹马'],
      ['vc_zh_male_silang', '四郎 2.0'],
      ['vc_zh_male_dayi', '大壹 2.0'],
      ['vc_zh_male_tiancaitongsheng', '天才童声 2.0'],
      ['vc_zh_male_naiqimengwa', '奶气萌娃 2.0'],
      ['vc_zh_male_taocheng', '小天 2.0'],
      ['vc_zh_male_shaonianzixin', '少年梓辛/Brayan 2.0'],
      ['vc_zh_male_guanggaojieshuo', '广告解说 2.0'],
      ['vc_zh_male_zhuangzhou', '庄周 2.0'],
      ['vc_zh_male_kailangxuezhang', '开朗学长 2.0'],
      ['vc_zh_male_kailangdidi', '开朗弟弟 2.0'],
      ['vc_zh_male_kuailexiaodong', '快乐小东 2.0'],
      ['vc_zh_male_youyoujunzi', '悠悠君子 2.0'],
      ['vc_zh_male_xuanyijieshuo', '悬疑解说 2.0'],
      ['vc_zh_male_lanyinmianbao', '懒音绵宝 2.0'],
      ['mm_Lyrical_Voice', '抒情男声'],
      ['mm_Humorous_Elder', '搞笑大爷'],
      ['mm_Male_Announcer', '播报男声'],
      ['vc_zh_male_qingcang', '擎苍 2.0'],
      ['mm_Reliable_Executive', '沉稳高管'],
      ['vc_zh_male_huolixiaoge', '活力小哥 2.0'],
      ['vc_zh_male_shenyeboke', '深夜播客 2.0'],
      ['mm_Pure-hearted_Boy', '清澈邻家弟弟'],
      ['vc_zh_male_qingshuangnanda', '清爽男大 2.0'],
      ['vc_zh_male_yuanboxiaoshu', '渊博小叔 2.0'],
      ['vc_zh_male_wennuanahu', '温暖阿虎/Alvin 2.0'],
      ['vc_zh_male_wenrouxiaoge', '温柔小哥 2.0'],
      ['mm_Gentleman', '温润男声'],
      ['mm_Gentle_Youth', '温润青年'],
      ['vc_zh_male_xionger', '熊二 2.0'],
      ['vc_zh_male_zhubajie', '猪八戒 2.0'],
      ['vc_zh_male_sunwukong', '猴哥 2.0'],
      ['mm_Straightforward_Boy', '率真弟弟'],
      ['mm_Radio_Host', '电台男主播'],
      ['mm_Sincere_Adult', '真诚青年'],
      ['vc_zh_male_cixingjieshuonan', '磁性解说男声/Morgan 2.0'],
      ['mm_male-qn-jingying', '精英青年音色'],
      ['mm_male-qn-jingying-jingpin', '精英青年音色-beta'],
      ['mm_clever_boy', '聪明男童'],
      ['vc_zh_male_jieshuoxiaoming', '解说小明 2.0'],
      ['vc_zh_male_yizhipiannan', '译制片男 2.0'],
      ['vc_zh_male_linjiananhai', '邻家男孩 2.0'],
      ['vc_zh_male_yangguangqingnian', '阳光青年 2.0'],
      ['vc_zh_male_baqiqingshu', '霸气青叔 2.0'],
      ['mm_badao_shaoye', '霸道少爷'],
      ['mm_male-qn-badao', '霸道青年音色'],
      ['mm_male-qn-badao-jingpin', '霸道青年音色-beta'],
      ['mm_male-qn-daxuesheng', '青年大学生音色'],
      ['mm_male-qn-daxuesheng-jingpin', '青年大学生音色-beta'],
      ['mm_male-qn-qingse', '青涩青年音色'],
      ['mm_male-qn-qingse-jingpin', '青涩青年音色-beta'],
      ['vc_zh_male_gaolengchenwen', '高冷沉稳 2.0'],
      ['vc_zh_male_lubanqihao', '鲁班七号 2.0'],
    ],
  },
  {
    tab: '普通话',
    group: '特色角色',
    voices: [
      ['vcc_anime_BV050', '动漫小新（动漫）'],
      ['vcc_anime_BV417', '动漫海星（动漫）'],
      ['vcc_anime_BV063', '动漫海绵（动漫）'],
      ['vcc_child_BV061', '天才童声（童声）'],
      ['vcc_child_BV051', '奶气萌娃（童声）'],
      ['vcc_child_BV064', '小萝莉（童声）'],
      ['vcc_narration_BV411', '影视解说小帅（解说）'],
      ['vcc_narration_BV412', '影视解说小美（解说）'],
      ['vcc_elder_BV157', '慈爱姥姥（老年）'],
      ['mm_Cute_Spirit', '憨憨萌兽'],
      ['vcc_audiobook_BV701', '擎苍（有声书）'],
      ['vcc_news_BV011', '新闻女声（新闻）'],
      ['vcc_news_BV012', '新闻男声（新闻）'],
      ['vcc_elder_BV158', '智慧老者（老年）'],
      ['vcc_narration_BV142', '沉稳解说男（解说）'],
      ['vcc_dub_BV408', '译制片男声（特色）'],
      ['vcc_rap_BR001', '说唱小哥（特色）'],
    ],
  },
  {
    tab: '方言',
    group: '粤语',
    voices: [
      ['mm_yue_ProfessionalHost_F', '专业女主持'],
      ['mm_yue_ProfessionalHost_M', '专业男主持'],
      ['mm_yue_CuteGirl', '可爱女孩'],
      ['mm_yue_KindWoman', '善良女声'],
      ['vcd_yue_BV424', '广东女仔'],
      ['vcd_yue_BV704', '方言灿灿·粤语'],
      ['mm_yue_PlayfulMan', '活泼男声'],
      ['mm_yue_GentleLady', '温柔女声'],
      ['vcd_yue_BV026', '港剧男神'],
    ],
  },
  {
    tab: '方言',
    group: '川渝话',
    voices: [
      ['vcd_chuanyu_BV221', '四川甜妹儿'],
      ['vcd_chengdu_BV704', '方言灿灿·成都'],
      ['vcd_chuanyu_BV019', '重庆小伙'],
      ['vcd_chuanyu_BV423', '重庆幺妹儿'],
    ],
  },
  {
    tab: '方言',
    group: '东北话',
    voices: [
      ['vcd_dongbei_BV020', '东北丫头'],
      ['vcd_dongbei_BV021', '东北老铁'],
      ['vcd_dongbei_BV704', '方言灿灿·东北'],
    ],
  },
  {
    tab: '方言',
    group: '上海话',
    voices: [
      ['vcd_shanghai_BV704', '方言灿灿·上海'],
      ['vcd_shanghai_BV217', '沪上阿姐'],
    ],
  },
  {
    tab: '方言',
    group: '西安话',
    voices: [
      ['vcd_xian_BV704', '方言灿灿·西安'],
      ['vcd_xian_BV210', '西安佟掌柜'],
    ],
  },
  {
    tab: '方言',
    group: '天津话',
    voices: [['vcd_tianjin_BV212', '相声演员']],
  },
  {
    tab: '方言',
    group: '郑州话',
    voices: [['vcd_zhengzhou_BV214', '乡村企业家']],
  },
  {
    tab: '方言',
    group: '长沙话',
    voices: [['vcd_changsha_BV216', '长沙靓女']],
  },
  {
    tab: '方言',
    group: '台湾普通话',
    voices: [
      ['vcd_taipu_BV227', '台普男声'],
      ['vcd_taipu_BV704', '方言灿灿·台普'],
      ['vcd_taipu_BV025', '甜美台妹'],
    ],
  },
  {
    tab: '方言',
    group: '港式普通话',
    voices: [
      ['vc_zh_female_tvbnv', 'TVB女声 2.0'],
      ['mm_HK_Flight_Attendant', '港普空姐'],
    ],
  },
  {
    tab: '方言',
    group: '广西普通话',
    voices: [
      ['vcd_guangxi_BV213', '广西表哥'],
      ['vcd_guangxi_BV704', '方言灿灿·广西'],
    ],
  },
  {
    tab: '方言',
    group: '湖南普通话',
    voices: [['vcd_hunan_BV226', '湖南妹坨']],
  },
  {
    tab: 'English',
    group: '英式英语',
    voices: [['ven_uk_BV040_Anna', '亲切女声 Anna']],
  },
  {
    tab: 'English',
    group: '美式英语',
    voices: [
      ['ven_us_BV702_Stefan', 'Stefan 男声'],
      ['ven_us_BV138_Lawrence', '情感女声 Lawrence'],
      ['ven_us_BV511_Ava', '慵懒女声 Ava'],
      ['ven_us_BV503_Ariana', '活力女声 Ariana'],
      ['ven_us_BV504_Jackson', '活力男声 Jackson'],
      ['ven_us_BV027_Amelia', '美式女声 Amelia'],
      ['ven_us_BV502_Amanda', '讲述女声 Amanda'],
    ],
  },
  {
    tab: 'English',
    group: '澳洲英语',
    voices: [
      ['mm_Aussie_Bloke', 'Aussie Bloke'],
      ['ven_au_BV516_Henry', '澳洲男声 Henry'],
    ],
  },
  {
    tab: 'English',
    group: '未标注口音',
    voices: [
      ['vc_en_female_dacey', 'Dacey'],
      ['mm_Diligent_Man', 'Diligent Man'],
      ['mm_Gentle-voiced_man', 'Gentle-voiced man'],
      ['mm_Graceful_Lady', 'Graceful Lady'],
      ['vc_en_female_stokie', 'Stokie'],
      ['vc_en_male_tim', 'Tim'],
      ['mm_Trustworthy_Man', 'Trustworthy Man'],
      ['mm_Whispering_girl', 'Whispering girl'],
    ],
  },
];

export const VOICE_COUNT = VOICE_GROUPS.reduce(
  (n, g) => n + g.voices.length,
  0,
);
