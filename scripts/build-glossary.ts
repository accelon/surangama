#!/usr/bin/env bun
/**
 * 楞嚴速查小辭典：詞條 + 簡釋 + 梵/藏/英 + 主文出處（occurrences）+ 注疏命中數。
 *
 *   bun run scripts/build-glossary.ts
 *
 * 讀 data/sutra.json、data/works/*.json
 * 寫 data/glossary.json
 *
 * 藏文欄位只填「有把握的標準對譯」；其餘留 null，等藏譯本進來再補。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; page: string; text: string }[];
};
const works: { id: string; title: string; text: string }[] = [];
for (const f of readdirSync(join(DATA, 'works'))) works.push(JSON.parse(readFileSync(join(DATA, 'works', f), 'utf8')));
works.push(JSON.parse(readFileSync(join(DATA, 'lc.json'), 'utf8')));
works.sort((a, b) => a.id.localeCompare(b.id));

interface Entry {
  id: string;
  term: string;
  aliases?: string[];
  category: '經中人物' | '歷代人物' | '名詞' | '論點' | '主張' | '當代見解' | '譯者版本';
  gloss: string;
  sa?: string | null;
  tib?: string | null;
  en?: string | null;
  ref?: string;
  /** 編者按：不是注疏原文，是站上的比對／判斷 */
  editorNote?: string;
}

const E: Entry[] = [
  // ---------- 人物 ----------
  { id: 'p-buddha', term: '佛', aliases: ['世尊', '如來'], category: '經中人物', sa: 'Buddha', tib: 'སངས་རྒྱས', en: 'the Buddha', gloss: '本經說法主，釋迦牟尼佛；經中多稱「世尊」或「如來」。' },
  { id: 'p-ananda', term: '阿難', aliases: ['阿難陀'], category: '經中人物', sa: 'Ānanda', tib: 'ཀུན་དགའ་བོ', en: 'Ānanda', gloss: '佛陀堂弟、十大弟子之一，多聞第一；本經的當機者，因遭摩登伽女之難而啟請修行。' },
  { id: 'p-matangi', term: '摩登伽', aliases: ['摩登伽女'], category: '經中人物', sa: 'Mātaṅgī', tib: null, en: 'Mātaṅgī', gloss: '摩登伽族之女，以娑毗迦羅先梵天咒迷惑阿難，是本品開演的因緣。' },
  { id: 'p-manjushri', term: '文殊師利', aliases: ['文殊'], category: '經中人物', sa: 'Mañjuśrī', tib: 'འཇམ་དཔལ་དབྱངས', en: 'Mañjuśrī', gloss: '大智第一的菩薩；經中奉佛命持咒救阿難，末後為大眾揀選圓通。' },
  { id: 'p-avalokiteshvara', term: '觀世音', aliases: ['觀音'], category: '經中人物', sa: 'Avalokiteśvara', tib: 'སྤྱན་རས་གཟིགས', en: 'Avalokiteśvara', gloss: '以耳根圓通得道的菩薩；〈觀音圓通章〉是本經最流通的一段。' },
  { id: 'p-mahasthamaprapta', term: '大勢至', aliases: [], category: '經中人物', sa: 'Mahāsthāmaprāpta', tib: 'མཐུ་ཆེན་ཐོབ', en: 'Mahāsthāmaprāpta', gloss: '以念佛圓通得道的菩薩；〈大勢至圓通章〉為淨土法門所重。' },
  { id: 'p-purna', term: '富樓那', aliases: ['富樓那彌多羅尼子'], category: '經中人物', sa: 'Pūrṇa Maitrāyaṇīputra', tib: 'གང་པོ', en: 'Pūrṇa', gloss: '說法第一的弟子；經中問「清淨本然，云何忽生山河大地」，引出三種相續。' },
  { id: 'p-prasenajit', term: '波斯匿王', aliases: ['波斯匿'], category: '經中人物', sa: 'Prasenajit', tib: 'གསལ་རྒྱལ', en: 'King Prasenajit', gloss: '舍衛國王；經中問佛「見恆河」以驗見性不滅。' },
  { id: 'p-subhuti', term: '須菩提', aliases: [], category: '經中人物', sa: 'Subhūti', tib: 'རབ་འབྱོར', en: 'Subhūti', gloss: '解空第一的弟子；二十五圓通中以「意根」得道。' },
  { id: 'p-shariputra', term: '舍利弗', aliases: [], category: '經中人物', sa: 'Śāriputra', tib: 'ཤཱ་རིའི་བུ', en: 'Śāriputra', gloss: '智慧第一的弟子；二十五圓通中以「眼識」得道。' },
  { id: 'p-maudgalyayana', term: '目犍連', aliases: ['大目犍連'], category: '經中人物', sa: 'Maudgalyāyana', tib: 'མོ་གལ་གྱི་བུ', en: 'Maudgalyāyana', gloss: '神通第一的弟子；二十五圓通中以「意識」得道。' },
  { id: 'p-mahakashyapa', term: '大迦葉', aliases: ['迦葉'], category: '經中人物', sa: 'Mahākāśyapa', tib: 'འོད་སྲུང་ཆེན་པོ', en: 'Mahākāśyapa', gloss: '頭陀第一；二十五圓通中以「法塵」得道。' },
  { id: 'p-maitreya', term: '彌勒', aliases: ['彌勒菩薩'], category: '經中人物', sa: 'Maitreya', tib: 'བྱམས་པ', en: 'Maitreya', gloss: '當來下生佛；二十五圓通中以「識大」得道。' },
  { id: 'p-samantabhadra', term: '普賢', aliases: ['普賢菩薩'], category: '經中人物', sa: 'Samantabhadra', tib: 'ཀུན་ཏུ་བཟང་པོ', en: 'Samantabhadra', gloss: '大行菩薩；二十五圓通中以身根/觸塵得道。' },
  { id: 'p-akashagarbha', term: '虛空藏', aliases: ['虛空藏菩薩'], category: '經中人物', sa: 'Ākāśagarbha', tib: 'ནམ་མཁའི་སྙིང་པོ', en: 'Ākāśagarbha', gloss: '以「空大」得道的菩薩。' },
  { id: 'p-aniruddha', term: '阿那律', aliases: [], category: '經中人物', sa: 'Aniruddha', tib: 'མ་འགགས་པ', en: 'Aniruddha', gloss: '天眼第一；二十五圓通中以「眼根」得道。' },
  { id: 'p-upali', term: '優波離', aliases: [], category: '經中人物', sa: 'Upāli', tib: 'ཉེ་བར་འཁོར', en: 'Upāli', gloss: '持律第一；二十五圓通中以「身識」得道。' },
  { id: 'p-cudapanthaka', term: '周利槃特迦', aliases: ['周利槃特'], category: '經中人物', sa: 'Cūḍapanthaka', tib: null, en: 'Cūḍapanthaka', gloss: '以愚鈍著名，佛教他安居調出入息；觀息生住異滅而豁然得悟，是〈鼻根圓通〉的主角。' },
  { id: 'p-sundarananda', term: '孫陀羅難陀', aliases: [], category: '經中人物', sa: 'Sundarananda', tib: null, en: 'Sundarananda', gloss: '佛陀異母弟；〈鼻識圓通〉以「觀鼻端白」入道，見息如煙、鼻息成白，終至「諸出入息化為光明」。' },
  { id: 'p-lu-cheng', term: '呂澂', aliases: ['呂秋逸'], category: '歷代人物', sa: null, tib: null, en: 'Lü Cheng', gloss: '近代佛學家（1896–1989），《楞嚴百偽》作者；主張本經為中國人所造，列百條「偽撰之證」，是近代談楞嚴繞不開的一家。' },
  { id: 'p-liang-qichao', term: '梁啟超', aliases: ['梁任公'], category: '歷代人物', sa: null, tib: null, en: 'Liang Qichao', gloss: '近代學者（1873–1929）；《古書真偽及其年代》說「真正的佛經並沒有《楞嚴經》一類的話，可知《楞嚴經》一書是假書」，與呂澂同調。' },
  { id: 'p-zixuan', term: '子璿', aliases: ['長水子璿'], category: '歷代人物', sa: null, tib: null, en: 'Zixuan', gloss: '宋代長水沙門；《首楞嚴義疏注經》（T1799）以賢首十門釋經，是現存大正藏唯一楞嚴注。' },
  { id: 'p-jiehuan', term: '戒環', aliases: [], category: '歷代人物', sa: null, tib: null, en: 'Jie Huan', gloss: '宋代沙門；《楞嚴經要解》（X270），以簡明見性為宗，宋元以來流通甚廣。' },
  { id: 'p-jiaoguang', term: '交光真鑑', aliases: ['交光'], category: '歷代人物', sa: null, tib: null, en: 'Jiaoguang Zhenjian', gloss: '明代法師；《正脉疏》（X275），主張「捨識用根」，以六根之性為修因，是明清楞嚴學的主流詮釋之一。' },
  { id: 'p-hanshan', term: '憨山德清', aliases: ['憨山大師'], category: '歷代人物', sa: null, tib: null, en: 'Hanshan Deqing', gloss: '明代四大師之一；《楞嚴經通議》（X279），會通禪教，以如來藏為宗。' },
  { id: 'p-ouyi', term: '蕅益智旭', aliases: ['蕅益'], category: '歷代人物', sa: null, tib: null, en: 'Ouyi Zhixu', gloss: '明代四大師之一；《楞嚴玄義》（X284）、《文句》（X285），以天台五重玄義釋經。' },
  { id: 'p-zengfengyi', term: '曾鳳儀', aliases: [], category: '歷代人物', sa: null, tib: null, en: 'Zeng Fengyi', gloss: '明代居士；《楞嚴經宗通》（X318），以禪門「宗通」立場釋經。' },
  { id: 'p-qianqianyi', term: '錢謙益', aliases: ['蒙叟', '虞山'], category: '歷代人物', sa: null, tib: null, en: 'Qian Qianyi', gloss: '明末清初居士；《楞嚴經疏解蒙鈔》（X287），集古今疏解，卷首列「古今疏解品目」「諮決疑義十科」。乾隆三十八年被毁撤。' },
  { id: 'p-yuanying', term: '圓瑛', aliases: ['圓瑛法師'], category: '歷代人物', sa: null, tib: null, en: 'Yuanying', gloss: '民國法師；《大佛頂首楞嚴經講義》（LIB），謹遵賢首十門，會通天台、禪、淨，是近代最流通的講義。' },
  { id: 'p-taixu', term: '太虛', aliases: ['太虛大師'], category: '歷代人物', sa: null, tib: null, en: 'Taixu', gloss: '近代佛教改革家（1890–1947）；《楞嚴經攝論》主張本經為真經，反對「中國人造」的定性，是民國時期最主要的辯護者之一。' },
  { id: 'p-shoupei', term: '守培', aliases: ['守培法師'], category: '歷代人物', sa: null, tib: null, en: 'Shoupei', gloss: '近代法師（1884–1955）；《大佛頂首楞嚴經妙心疏》力主真經，逐條回應疑偽之說。' },

  // ---------- 名詞 ----------
  { id: 'n-shurangama', term: '首楞嚴', aliases: ['楞嚴'], category: '名詞', sa: 'śūraṅgama', tib: null, en: 'Śūraṅgama', gloss: '「健行／健相」之定，謂諸佛及十地菩薩所得的三昧；經名即取此義。' },
  { id: 'n-tathagatagarbha', term: '如來藏', aliases: [], category: '名詞', sa: 'tathāgatagarbha', tib: 'དེ་བཞིན་གཤེགས་པའི་སྙིང་པོ', en: 'Tathāgata store', gloss: '一切眾生本具的如來智慧德相；本經以「如來藏妙真如性」統攝四科七大。' },
  { id: 'n-tathata', term: '真如', aliases: ['妙真如性'], category: '名詞', sa: 'tathatā', tib: 'དེ་བཞིན་ཉིད', en: 'suchness', gloss: '諸法真實不虛、常住不變的本性。' },
  { id: 'n-bodhi', term: '菩提', aliases: [], category: '名詞', sa: 'bodhi', tib: 'བྱང་ཆུབ', en: 'enlightenment', gloss: '覺悟；經中分「真性菩提、實智菩提、方便菩提」等。' },
  { id: 'n-nirvana', term: '涅槃', aliases: [], category: '名詞', sa: 'nirvāṇa', tib: 'མྱ་ངན་ལས་འདས་པ', en: 'nirvāṇa', gloss: '煩惱與生死永盡的寂滅境界。' },
  { id: 'n-avidya', term: '無明', aliases: [], category: '名詞', sa: 'avidyā', tib: 'མ་རིག་པ', en: 'ignorance', gloss: '不明諸法實相的癡；經中說「知見立知，即無明本」。' },
  { id: 'n-karma', term: '業', aliases: [], category: '名詞', sa: 'karman', tib: 'ལས', en: 'karma', gloss: '身口意的造作，能招感未來果報。' },
  { id: 'n-samsara', term: '輪迴', aliases: ['生死'], category: '名詞', sa: 'saṃsāra', tib: 'འཁོར་བ', en: 'saṃsāra', gloss: '眾生依業力在六道中流轉生死。' },
  { id: 'n-samadhi', term: '三摩提', aliases: ['三昧', '三摩地'], category: '名詞', sa: 'samādhi', tib: 'ཏིང་ངེ་འཛིན', en: 'samādhi', gloss: '心一境性、等持；本經三名（奢摩他、三摩缽提、禪那）之一。' },
  { id: 'n-shamatha', term: '奢摩他', aliases: [], category: '名詞', sa: 'śamatha', tib: 'ཞི་གནས', en: 'śamatha (calm abiding)', gloss: '止、寂靜；經中為「最初方便」的觀行之一。' },
  { id: 'n-samapatti', term: '三摩缽提', aliases: ['三摩缽底'], category: '名詞', sa: 'samāpatti', tib: 'སྙོམས་པར་འཇུག་པ', en: 'samāpatti', gloss: '等至；經中三名之一，偏重觀。' },
  { id: 'n-dhyana', term: '禪那', aliases: [], category: '名詞', sa: 'dhyāna', tib: 'བསམ་གཏན', en: 'dhyāna', gloss: '靜慮；經中三名之一，止觀均等。' },
  { id: 'n-skandha', term: '五陰', aliases: ['五蘊'], category: '名詞', sa: 'pañcaskandha', tib: 'ཕུང་པོ་ལྔ', en: 'five aggregates', gloss: '色、受、想、行、識；本經一一說為如來藏妙真如性。' },
  { id: 'n-ayatana6', term: '六入', aliases: [], category: '名詞', sa: 'ṣaḍāyatana', tib: 'སྐྱེ་མཆེད་དྲུག', en: 'six sense bases', gloss: '眼、耳、鼻、舌、身、意六根對六塵的入處。' },
  { id: 'n-ayatana12', term: '十二處', aliases: [], category: '名詞', sa: 'dvādaśāyatana', tib: 'སྐྱེ་མཆེད་བཅུ་གཉིས', en: 'twelve sense bases', gloss: '六根與六塵。' },
  { id: 'n-dhatu18', term: '十八界', aliases: [], category: '名詞', sa: 'aṣṭādaśadhātu', tib: 'ཁམས་བཅོ་བརྒྱད', en: 'eighteen elements', gloss: '六根、六塵、六識。' },
  { id: 'n-dhatu7', term: '七大', aliases: [], category: '名詞', sa: 'saptadhātu', tib: 'ཁམས་བདུན', en: 'seven elements', gloss: '地、水、火、風、空、見、識；本經說皆如來藏。' },
  { id: 'n-drywisdom', term: '乾慧地', aliases: [], category: '名詞', sa: null, tib: null, en: 'stage of dry wisdom', gloss: '五十五位之首，欲愛乾枯、智慧初現而未證真。' },
  { id: 'n-dasabhumi', term: '十地', aliases: [], category: '名詞', sa: 'daśabhūmi', tib: 'ས་བཅུ', en: 'ten grounds', gloss: '菩薩十地，自歡喜地至法雲地。' },
  { id: 'n-sevenrealms', term: '七趣', aliases: [], category: '名詞', sa: null, tib: null, en: 'seven destinies', gloss: '六道再加仙趣；經中詳說其升沉因果。' },
  { id: 'n-twelvebirths', term: '十二類生', aliases: [], category: '名詞', sa: null, tib: null, en: 'twelve categories of beings', gloss: '卵、胎、濕、化、有色、無色、有想、無想、非有色、非無色、非有想、非無想。' },
  { id: 'n-fiftydemons', term: '五十陰魔', aliases: ['五陰魔'], category: '名詞', sa: null, tib: null, en: 'fifty demonic states', gloss: '色受想行識五陰各十種魔境，修行人須知。' },
  { id: 'n-asubha', term: '不淨觀', aliases: ['白骨觀'], category: '名詞', sa: 'aśubhā', tib: null, en: 'contemplation of impurity', gloss: '觀身不淨、白骨、微塵而歸於空。經中優波尼沙陀（卷5, 19p125c）以此為色塵圓通：「觀不淨相，生大厭離……從不淨、白骨、微塵歸於虛空」。上座部的主要業處之一。' },
  { id: 'n-ninth-samadhi', term: '九次第定', aliases: ['九次第定'], category: '名詞', sa: 'navānupūrva-samāpatti', tib: null, en: 'nine successive absorptions', gloss: '四禪、四無色定、滅盡定合為九次第定。經中說「現前雖成九次第定，不得漏盡成阿羅漢，皆由執此生死妄想」（卷1, 19p109a）——把定學階梯當成須被超越的對象。' },
  { id: 'n-fourfoods', term: '四食', aliases: ['段食'], category: '名詞', sa: 'catvāra āhārāḥ', tib: null, en: 'four kinds of nutriment', gloss: '段食、觸食、思食、識食。經中說十二類生「不能自全，依四食住」（卷8, 19p141c）；早期阿毗達磨的生存論，大乘經少見。' },
  { id: 'n-twentyfive', term: '二十五圓通', aliases: [], category: '名詞', sa: null, tib: null, en: 'twenty-five means to perfect penetration', gloss: '六塵、六根、六識、七大各一法門，共二十五聖各說圓通。' },
  { id: 'n-anapana', term: '安般', aliases: ['安那般那', '入出息念'], category: '名詞', sa: 'ānāpāna', tib: 'དབུགས་འབྱུང་བ་དང་རྒྱུ་བ', en: 'mindfulness of breathing', gloss: '數息／隨息觀，上座部（Theravāda）的根本禪法。所緣是「人中附近的氣息本身」，不隨息進出、也不注意鼻端感覺；初學者從呼吸本身開始（《大念住經》詳述）。注疏中唯蕅益《文句》（X285, p.304b）與溥畹《寶鏡疏》（X316, p.534c）明言「安那般那」；子璿、戒環、交光、憨山、圓瑛等只說「數息／調息」。' },
  { id: 'n-satipatthana', term: '大念住經', aliases: ['念處經', 'Mahāsatipaṭṭhāna'], category: '名詞', sa: 'Mahāsatipaṭṭhāna Sutta', tib: null, en: 'Great Discourse on the Foundations of Mindfulness', gloss: '南傳《中部》第 10 經（漢譯對應《中阿含》第 98 經《念處經》）；安般念的修法與所緣——人中附近的氣息——見此經。' },

  // ---------- 論點 ----------
  { id: 'a-sevenplaces', term: '七處徵心', aliases: ['七處征心'], category: '論點', sa: null, tib: null, en: 'seven locations of the mind', gloss: '佛七處破阿難「心在何處」：身內、身外、潛根、見內、隨合、中間、無著。' },
  { id: 'a-tenseeings', term: '十番顯見', aliases: ['十番顯見'], category: '論點', sa: null, tib: null, en: 'ten demonstrations of seeing', gloss: '十番開顯見性：是心、不動、不滅、不失、無還、不雜、無礙、不分、超情、離見。' },
  { id: 'a-tworoots', term: '二種根本', aliases: [], category: '論點', sa: null, tib: null, en: 'two roots', gloss: '生死根本（攀緣心）與菩提涅槃元清淨體（識精元明）。' },
  { id: 'a-twodecisive', term: '二決定義', aliases: [], category: '論點', sa: null, tib: null, en: 'two decisive meanings', gloss: '一、因地心與果地覺相應；二、以六根為煩惱根本而選圓通。' },
  { id: 'a-sixknots', term: '六解一亡', aliases: ['六結'], category: '論點', sa: null, tib: null, en: 'six knots untied', gloss: '以巾結喻六根之結，一結解則六結俱解。' },
  { id: 'a-ear', term: '耳根圓通', aliases: ['觀音圓通'], category: '論點', sa: null, tib: null, en: 'perfect penetration through the ear', gloss: '觀世音以「反聞聞自性」得道，文殊揀選為此土最當機的法門。' },
  { id: 'a-nose-root', term: '鼻根圓通', aliases: ['調出入息'], category: '論點', sa: null, tib: null, en: 'perfect penetration through the nose', gloss: '周利槃特迦以觀出入息，見息生住異滅而豁然得悟，「返息循空」為第一。諸家多以「數息」釋之，唯蕅益、溥畹直指為安那般那三昧。' },
  { id: 'a-nose-tip', term: '觀鼻端白', aliases: ['鼻識圓通', '息化光明'], category: '論點', sa: null, tib: null, en: 'contemplating whiteness at the nose tip', gloss: '孫陀羅難陀的鼻識圓通：諦觀鼻端，見出入息如煙，煙相漸銷而鼻息成白，終至「諸出入息化為光明，照十方界」。注疏未用「禪相」一詞；《指掌疏》稱鼻端白為「致心一境」、後見煙白為「定深別境」，《寶鏡疏》稱之為「所住之境」，功能上近於禪相，但所緣不同（見編者按）。', editorNote: '編者按：相似的是「修息到某階段現起的相」——《清淨道論》安般念到取相（uggaha）時現起光相，與本經「鼻端白→煙→白」的次第相當接近，似相（paṭibhāga）尚未現前。但所緣不同：安般念的所緣是人中附近的氣息本身，不隨息進出、不注意鼻端感覺；「鼻尖白色」初學者根本看不到，不可能作初學所緣，初學者只能從呼吸本身開始（《大念住經》）。故此比對只限「相的階段」，不是同一法門。' },
  { id: 'n-nimitta', term: '取相・似相', aliases: ['禪相', 'uggaha-nimitta', 'paṭibhāga-nimitta'], category: '名詞', sa: 'uggaha-nimitta / paṭibhāga-nimitta', tib: null, en: 'learning sign / counterpart sign', gloss: '《清淨道論》安般念的禪相三階段：遍作相（parikamma）→取相（uggaha，初現、較粗）→似相（paṭibhāga，晶瑩剔透、穩定）。帕奧禪師《智慧之光》詳述此三階段，並以似相為入安止定的所緣。安般念的所緣是人中附近的氣息本身，不是鼻端色法。', editorNote: '編者按：本經「觀鼻端白」見煙、煙銷息白，與取相階段相當接近；但安般念以氣息為所緣、不取鼻端色法，初學者亦看不到白相。經文「諸出入息化為光明」是否即似相，編者未斷言。此為階段的比對，非同一所緣。' },
  { id: 'a-fourskandhas', term: '四科七大皆如來藏', aliases: ['四科七大'], category: '論點', sa: null, tib: null, en: 'four sets and seven elements are the Tathāgata store', gloss: '五陰、六入、十二處、十八界、七大，一一皆如來藏妙真如性。' },
  { id: 'a-threegradual', term: '三漸次', aliases: [], category: '論點', sa: null, tib: null, en: 'three gradual stages', gloss: '除其助因、刳其正性、違其現業。' },
  { id: 'a-fiftyfive', term: '五十五位', aliases: [], category: '論點', sa: null, tib: null, en: 'fifty-five stages', gloss: '乾慧地、十信、十住、十行、十迴向、四加行、十地、等覺的階位。' },
  { id: 'a-fourprecepts', term: '四種清淨明誨', aliases: ['四清淨明誨'], category: '論點', sa: null, tib: null, en: 'four clear instructions', gloss: '斷淫、斷殺、斷盜、斷妄語。' },
  { id: 'a-mantra', term: '楞嚴咒', aliases: ['佛頂咒', '首楞嚴咒'], category: '論點', sa: null, tib: null, en: 'Śūraṅgama mantra', gloss: '卷七的長咒；經中說能破魔、護持修行。' },

  // ---------- 主張 ----------
  { id: 'd-shishe', term: '捨識用根', aliases: [], category: '主張', sa: null, tib: null, en: 'discard consciousness, use the faculties', gloss: '交光的主張：用根不用識——識以生滅為本，修因如蒸沙作飯；根性則不生滅，故為修楞嚴之要（X275）。圓瑛也稱「捨識用根，為修楞嚴要旨」（LIB）。' },
  { id: 'd-xianshou', term: '賢首十門', aliases: [], category: '主張', sa: null, tib: null, en: 'ten gates of the Huayan school', gloss: '以賢首（華嚴）宗的十門懸敘釋經：子璿《義疏注經》開其端，圓瑛《講義》明說「今解此經，謹遵賢首十門解釋」（T1799、LIB）。' },
  { id: 'd-tiantai', term: '天台五重玄義', aliases: [], category: '主張', sa: null, tib: null, en: 'Tiantai fivefold Profound Meaning', gloss: '以天台五重玄義（名、體、宗、用、教相）釋經；蕅益《楞嚴玄義》（X284）、《文句》（X285）屬此系，錢謙益《蒙鈔》品目也把它列在天台之下。' },
  { id: 'd-zongtong', term: '宗通', aliases: [], category: '主張', sa: null, tib: null, en: 'Zongtong', gloss: '曾鳳儀的禪門立場：以「宗通」說經，不依教下名相，直指心性（X318 書名即《楞嚴宗通》）。' },
  { id: 'd-jijie', term: '集解', aliases: ['古今疏解品目'], category: '主張', sa: null, tib: null, en: 'compendium', gloss: '錢謙益《蒙鈔》的體例：集古今疏解於一書，卷首列「古今疏解品目」與「諮決疑義十科」（X287）。' },
  { id: 'd-baivei', term: '百偽', aliases: ['楞嚴百偽'], category: '當代見解', sa: null, tib: null, en: 'hundred falsifications', gloss: '呂澂《楞嚴百偽》的主張：本經為中國人所造，列百條「偽撰之證」，從經題、譯者、僧制到名相逐條質疑。' },
  { id: 'd-jiashu', term: '假書', aliases: [], category: '當代見解', sa: null, tib: null, en: 'spurious book', gloss: '梁啟超《古書真偽及其年代》的主張：「真正的佛經並沒有《楞嚴經》一類的話，可知《楞嚴經》一書是假書。」' },
  { id: 'd-zhenjing', term: '真經說', aliases: ['非偽說'], category: '當代見解', sa: null, tib: null, en: 'authenticity defense', gloss: '反對呂澂、梁啟超的代表意見：以《開元釋教錄》的譯場記載、房融筆受的可行性、經文與印度大乘論書的相通，主張本經確為譯本而非中土偽撰。太虛《楞嚴經攝論》、守培《妙心疏》、圓瑛《講義》都持此立場。' },

  // ---------- 當代見解 ----------
  { id: 'c-title', term: '經題・灌頂部', aliases: [], category: '當代見解', ref: '偽1–2', gloss: '呂澂：經題下註「一名中印度那爛陀大道場經，於灌頂部錄出別行」是竊《陀羅尼集經序》而臆改；全經無入灌頂壇之說，「灌頂部」出處杜撰。' },
  { id: 'c-translator', term: '房融筆授・懷迪證譯', aliases: [], category: '當代見解', ref: '偽3–4', gloss: '呂澂：房融神龍元年二月已流放高州，不可能在廣州從容筆授；懷迪證譯的時間與《大寶積經》譯場相差八年，也對不上。' },
  { id: 'c-ananda', term: '阿難遭摩登伽', aliases: [], category: '當代見解', ref: '偽5–8', gloss: '呂澂：阿難當時已為侍者，不應遠遊；自恣後不得離界乞食、受王請；賤族居城外，阿難不應過淫女之居。' },
  { id: 'c-names', term: '三摩提名相', aliases: [], category: '當代見解', ref: '偽11', gloss: '呂澂：奢摩他、三摩缽提、禪那三名是改《圓覺》而來，又把三摩缽底略作「三摩」，名相支離。' },
  { id: 'c-sevenplaces', term: '七處徵心出處', aliases: [], category: '當代見解', ref: '偽12', gloss: '呂澂：阿難出家因王命、時猶童稚，經中卻說見佛相好而剃落，並由此生出七處徵心一大段，是杜撰。' },
  { id: 'c-tathagata', term: '如來藏生山河', aliases: [], category: '當代見解', ref: '偽35', gloss: '呂澂：說山河大地「依」如來藏尚可，說「生」山河大地則顛倒；富樓那問答一段即由此立論。' },
  { id: 'c-yuanhong', term: '二十五圓通名號', aliases: [], category: '當代見解', ref: '偽49', gloss: '呂澂：「優波尼沙陀」是數量極少之稱，佛弟子無此號，經中杜撰以說色因圓通。' },
  { id: 'c-mantra', term: '咒文非出一手', aliases: [], category: '當代見解', ref: '偽69', gloss: '呂澂：咒文與經文非出一手；若以咒文有據反證經文，是顛倒。' },
  { id: 'c-stages', term: '漸次與乾慧', aliases: [], category: '當代見解', ref: '偽76', gloss: '呂澂：十地最後金剛喻心剎那斷證，無漸次；經中卻說金剛心中初乾慧地重重十二，與唯識不符。' },

  // ---------- 譯者版本 ----------
  { id: 'v-paramiti', term: '般剌蜜帝', aliases: ['般剌蜜諦'], category: '譯者版本', sa: 'Paramiti', tib: null, en: 'Paramiti', gloss: '中天竺沙門，唐神龍元年於廣州制止道場譯出本經，房融筆受。' },
  { id: 'v-fangrong', term: '房融', aliases: [], category: '譯者版本', sa: null, tib: null, en: 'Fang Rong', gloss: '唐代宰相，傳說為本經筆受者；呂澂以其流放時間質疑此說。' },
  { id: 'v-huaidi', term: '懷迪', aliases: [], category: '譯者版本', sa: null, tib: null, en: 'Huai Di', gloss: '傳說中本經的證譯者；呂澂考其時間不合。' },
  { id: 'v-mengchao', term: '錢謙益《疏解蒙鈔》', aliases: ['蒙鈔'], category: '譯者版本', sa: null, tib: null, en: 'Qian Qianyi, Mengchao', gloss: '明末清初錢謙益的楞嚴集解（X287）；乾隆三十八年（1773）隨清藏清理被整部撤毀、經板削汰。X287 仍保留其名與自序，屬未毁系統；嘉興藏本（東大 12 冊、1,058 頁）待對勘。' },
  { id: 'v-censorship', term: '蒙鈔毁撤', aliases: ['乾隆削板'], category: '譯者版本', sa: null, tib: null, en: '1773 suppression', gloss: '乾隆三十八年清字經館清理續藏，諭旨：「其錢謙益所著楞嚴蒙鈔一種亦據奏請毁撤，所有經板書篇均經一體芟汰」——整部撤出藏經、經板削毀。錢謙益列貳臣、著作禁毀，加上續藏體例清理，兩層原因疊在一起。' },
  { id: 'v-tibetan', term: '藏譯本', aliases: ['西藏譯本'], category: '譯者版本', sa: null, tib: null, en: 'Tibetan translation', gloss: '藏文大藏經 H259，10 個 bam po、約 42 萬字元，譯自漢文；全文已入手（data/tibetan.json），用於梵藏對照。' },
  { id: 'v-edkins', term: 'Joseph Edkins 英譯', aliases: ['艾約瑟'], category: '譯者版本', sa: null, tib: null, en: 'Joseph Edkins', gloss: '艾約瑟《Chinese Buddhism》(1893) 第十八章，節譯到十八界、約 4,400 詞；公版，已抽出（edkins-leng-yen-king.txt）。' },
];

// ---- 互連：id → 相關條目 id（UI 會渲染成可點 chips）
const RELATED: Record<string, string[]> = {
  'n-anapana': ['a-nose-root', 'a-nose-tip', 'n-nimitta', 'p-cudapanthaka', 'p-sundarananda'],
  'a-nose-root': ['n-anapana', 'p-cudapanthaka', 'a-nose-tip'],
  'a-nose-tip': ['n-nimitta', 'n-anapana', 'p-sundarananda', 'a-nose-root'],
  'n-nimitta': ['a-nose-tip', 'n-anapana'],
  'n-asubha': ['n-skandha', 'n-twentyfive'],
  'n-ninth-samadhi': ['n-samadhi', 'n-dhyana'],
  'n-fourfoods': ['n-twelvebirths', 'n-sevenrealms'],
  'n-sevenrealms': ['n-twelvebirths', 'n-fourfoods'],
  'n-twelvebirths': ['n-sevenrealms', 'n-fourfoods'],
  'n-fiftydemons': ['n-skandha'],
  'p-lu-cheng': ['d-baivei', 'c-title', 'c-translator', 'c-sevenplaces', 'p-liang-qichao'],
  'p-liang-qichao': ['d-jiashu', 'p-lu-cheng'],
  'p-zixuan': ['d-xianshou', 'n-tathagatagarbha'],
  'p-jiehuan': ['d-xianshou'],
  'p-jiaoguang': ['d-shishe', 'n-tathagatagarbha'],
  'p-hanshan': ['d-xianshou', 'n-tathagatagarbha'],
  'p-ouyi': ['d-tiantai', 'a-ear'],
  'p-zengfengyi': ['d-zongtong'],
  'p-qianqianyi': ['d-jijie', 'v-mengchao', 'v-censorship'],
  'p-yuanying': ['d-xianshou', 'd-shishe', 'a-ear', 'd-zhenjing'],
  'p-taixu': ['d-zhenjing', 'p-lu-cheng'],
  'p-shoupei': ['d-zhenjing', 'p-lu-cheng'],
  'd-zhenjing': ['p-taixu', 'p-shoupei', 'p-yuanying', 'p-lu-cheng', 'p-liang-qichao'],
  'd-shishe': ['p-jiaoguang', 'p-yuanying', 'n-tathagatagarbha'],
  'd-xianshou': ['p-zixuan', 'p-yuanying', 'p-hanshan'],
  'd-tiantai': ['p-ouyi'],
  'd-zongtong': ['p-zengfengyi'],
  'd-jijie': ['p-qianqianyi', 'v-mengchao'],
  'd-baivei': ['p-lu-cheng', 'c-title', 'c-translator', 'c-sevenplaces'],
  'd-jiashu': ['p-liang-qichao'],
  'v-mengchao': ['v-censorship', 'p-lu-cheng'],
  'v-censorship': ['v-mengchao'],
  'c-title': ['p-lu-cheng'],
  'c-translator': ['p-lu-cheng'],
  'c-sevenplaces': ['p-lu-cheng'],
  'p-cudapanthaka': ['n-anapana', 'a-nose-root'],
  'p-sundarananda': ['a-nose-tip', 'n-nimitta'],
};

// ---- 原文連結：條目 → 注疏／科判／當代文本裡的定位關鍵詞
const LINKS: Record<string, { work: string; kw: string }[]> = {
  'p-zixuan': [{ work: 'T1799', kw: '十門' }],
  'p-jiehuan': [{ work: 'X270', kw: '楞嚴經要解' }],
  'p-jiaoguang': [{ work: 'X275', kw: '用根不用' }],
  'p-hanshan': [{ work: 'X279', kw: '通議序' }],
  'p-ouyi': [{ work: 'X285', kw: '周利槃特迦' }],
  'p-zengfengyi': [{ work: 'X318', kw: '宗通緣起' }],
  'p-qianqianyi': [{ work: 'X287', kw: '古今疏解品目' }],
  'p-yuanying': [{ work: 'LIB', kw: '謹遵賢首十門' }],
  'd-shishe': [{ work: 'X275', kw: '用根不用' }, { work: 'LIB', kw: '捨識用根' }],
  'd-xianshou': [{ work: 'LIB', kw: '謹遵賢首十門' }, { work: 'T1799', kw: '十門' }],
  'd-tiantai': [{ work: 'X285', kw: '周利槃特迦' }],
  'd-zongtong': [{ work: 'X318', kw: '宗通緣起' }],
  'd-jijie': [{ work: 'X287', kw: '古今疏解品目' }],
  'd-baivei': [{ work: 'LC', kw: '楞嚴百偽' }],
  'a-nose-root': [{ work: 'T1799', kw: '周利槃特' }, { work: 'X285', kw: '周利槃特迦' }],
  'a-nose-tip': [{ work: 'X275', kw: '觀鼻端白' }, { work: 'X308', kw: '鼻端白' }],
  'n-anapana': [{ work: 'X316', kw: '安那般那' }, { work: 'X285', kw: '安那般' }],
  'n-nimitta': [{ work: 'X308', kw: '定深別境' }],
  'n-asubha': [{ work: 'T1799', kw: '優波尼沙陀' }],
  'n-fourthings': [],
};

// ---- 當代見解：指回被批評的經文
const TARGETS: Record<string, { kw: string }> = {
  'c-title': { kw: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經' },
  'c-translator': { kw: '大唐神龍元年' },
  'c-ananda': { kw: '摩登伽女' },
  'c-names': { kw: '首楞嚴王' },
  'c-sevenplaces': { kw: '徵心' },
  'c-tathagata': { kw: '山河大地' },
  'c-yuanhong': { kw: '優波尼沙陀' },
  'c-mantra': { kw: '薩怛他' },
  'c-stages': { kw: '三漸次' },
};

// ---- occurrences 與注疏命中數
const CATS = ['經中人物', '歷代人物', '名詞', '論點', '主張', '當代見解', '譯者版本'];

function countIn(text: string, needles: string[]): number {
  let n = 0;
  for (const nd of needles) {
    let i = 0;
    while ((i = text.indexOf(nd, i)) >= 0) { n++; i += nd.length; }
  }
  return n;
}

const entries = E.map((e) => {
  const needles = [e.term, ...(e.aliases ?? [])].filter((s) => s.length >= 1);
  const occ: { s: number; juan: number; page: string; quote: string }[] = [];
  let total = 0;
  for (const s of sutra.sentences) {
    let hit = false;
    for (const nd of needles) if (s.text.includes(nd)) { hit = true; break; }
    if (!hit) continue;
    total++;
    if (occ.length < 200) occ.push({ s: s.i, juan: s.juan, page: s.page, quote: s.text.length > 120 ? s.text.slice(0, 120) + '…' : s.text });
  }
  // 當代見解：以「被批評的經文」為出處
  const tgt = TARGETS[e.id];
  if (tgt) {
    const all = sutra.sentences.filter((s: { text: string; juan: number }) => s.text.includes(tgt.kw));
    const body = all.filter((s: { juan: number }) => s.juan > 0);
    const hits = body.length ? body : all;
    total = hits.length;
    occ.length = 0;
    for (const s of hits.slice(0, 200)) occ.push({ s: s.i, juan: s.juan, page: s.page, quote: s.text.length > 120 ? s.text.slice(0, 120) + '…' : s.text });
  }
  const workHits: Record<string, number> = {};
  const SELECT = new Set(['T1799', 'X270', 'X275', 'X279', 'X285', 'X318', 'LIB']);
  for (const w of works) {
    if (!SELECT.has(w.id)) continue;
    const c = countIn(w.text, needles);
    if (c) workHits[w.id] = c;
  }
  const workLinks = (LINKS[e.id] ?? []).map(({ work, kw }) => {
    const w = works.find((x) => x.id === work);
    const pos = w ? w.text.indexOf(kw) : -1;
    if (!w || pos < 0) return null;
    return { id: work, pos, quote: w.text.slice(pos, pos + 40).replace(/\s+/g, ' ') };
  }).filter((x): x is { id: string; pos: number; quote: string } => !!x);
  return {
    ...e,
    aliases: e.aliases ?? [],
    sa: e.sa ?? null, tib: e.tib ?? null, en: e.en ?? null,
    related: RELATED[e.id] ?? [],
    workLinks,
    count: total,
    occurrences: occ,
    truncated: total > occ.length,
    workHits,
  };
});

const out = {
  schema: 1,
  source: { sutra: 'T945', sentences: sutra.sentences.length, works: works.map((w) => w.id) },
  categories: CATS.map((c) => ({ id: c, label: c, count: entries.filter((e) => e.category === c).length })),
  entries,
};
writeFileSync(join(DATA, 'glossary.json'), JSON.stringify(out, null, 1) + '\n');

console.log(`詞條 ${entries.length}：` + CATS.map((c) => `${c} ${entries.filter((e) => e.category === c).length}`).join('、'));
const top = [...entries].sort((a, b) => b.count - a.count).slice(0, 8);
console.log('主文出現最多：' + top.map((e) => `${e.term}(${e.count})`).join(' '));
console.log('檔案：data/glossary.json');
