/* Explicit answer bank: contextual Egyptian sounds never inferred by letter replacement. */
(function (root) {
    'use strict';
    const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
    const SOUNDS = ['ʾ','b','t',null,'g','ḥ','kh','d',null,'r','z','s','sh','ṣ','ḍ','ṭ',null,'ʿ','gh','f','ʾ','k','l','m','n','h','w','y'];
    const HINTS = ['喉塞','不送气 b','不送气 t','','硬 g','咽部清擦音','赫（摩擦）','浊 d','','弹舌 r','浊 z','丝','诗','重 s','重 d','重 t','','咽音','浊喉擦音','夫','喉塞','不送气 k','勒','姆','恩','轻呼气 h','乌（滑音）','衣（滑音）'];
    const MARKS = ['َ','ِ','ُ','ْ'];
    const VOWELS = ['a','i','u',''];
    const VOWEL_HINTS = ['啊','衣','乌','不加元音'];
    const NON_JOINING = new Set('ادذرزو');
    // [letter, word, target grapheme index, target reading, mnemonic, whole-word reading, chinese meaning]
    const WORDS = [
        // 1. ا (Alif / Hamza)
        ['ا','اِسْمِي',0,'es','声门后短衣（名字·词首）','esmi','我的名字'],
        ['ا','بَاب',1,'ā','啊（长元音·词中）','bāb','门'],
        ['ا','كِتَاب',2,'ā','啊（长元音·词中）','kitāb','书'],
        ['ا','أَخْبَار',3,'ā','啊（长元音·词中）','akhbār','新闻'],
        ['ا','أَهْلًا',3,'lan','兰（词尾固定表达）','ahlan','你好'],
        ['ا','أَنَا',2,'ā','啊（长元音·词尾）','ana','我'],

        // 2. ب (Bāʾ)
        ['ب','بَاب',0,'bā','巴（拉长·词首）','bāb','门'],
        ['ب','بَيْت',0,'bē','贝（单元音拉长·词首）','bēt','房子'],
        ['ب','أَخْبَار',2,'bā','巴（拉长·词中）','akhbār','新闻'],
        ['ب','لَبَن',1,'ba','巴（短音·词中）','laban','牛奶'],
        ['ب','حَبِيبِي',1,'bi','比（短音·词中）','ḥabībi','亲爱的'],
        ['ب','كَلْب',2,'b','不送气 b（收尾·词尾）','kalb','狗'],
        ['ب','حُبّ',1,'bb','双写重音（叠音·词尾）','ḥobb','爱'],
        ['ب','حِجَاب',3,'b','不送气 b（收尾·词尾）','ḥegāb','头巾'],
        ['ب','وَاجِب',3,'b','不送气 b（收尾·词尾）','wāgeb','作业'],
        ['ب','كِتَاب',3,'b','不送气 b（收尾·词尾）','kitāb','书'],

        // 3. ت (Tāʾ)
        ['ت','تِين',0,'tī','提（拉长·词首）','tīn','无花果'],
        ['ت','تَمْر',0,'ta','塔（短音·词首）','tamr','椰枣'],
        ['ت','كِتَاب',1,'tā','塔（拉长·词中）','kitāb','书'],
        ['ت','فَتْحَة',1,'t','不送气 t（静音·词中）','fatḥa','开口符'],
        ['ت','بِنْت',2,'t','不送气 t（收尾·词尾）','bint','女孩'],
        ['ت','بَيْت',2,'t','不送气 t（收尾·词尾）','bēt','房子'],

        // 4. ث (Thāʾ - 埃及口语读 t 或 s)
        ['ث','ثَمَن',0,'ta','塔（埃及口音读 t·词首）','taman','价格'],
        ['ث','ثَانِيَة',0,'sa','萨（埃及口音读 s·词首）','sanya','秒/第二'],
        ['ث','مَثَل',1,'sa','萨（埃及口音读 s·词中）','masal','例如'],
        ['ث','ثَلَاثَة',0,'ta','塔（数字三读 t·词首）','talāta','数字三'],
        ['ث','بَحْث',2,'s','斯（学术/搜索读 s·词尾）','baḥs','搜索/研究'],

        // 5. ج (Jīm - 埃及口语读硬 g)
        ['ج','جَمَل',0,'ga','嘎（硬 g·词首）','gamal','骆驼'],
        ['ج','جِبْنَة',0,'gi','硬 g · 衣（词首）','gibna','奶酪'],
        ['ج','جِدَّة',0,'gi','硬 g · 衣（双写·词首）','gidda','奶奶'],
        ['ج','حِجَاب',1,'gā','嘎（硬 g·拉长·词中）','ḥegāb','头巾'],
        ['ج','وَاجِب',2,'ge','硬 g · 衣（短音·词中）','wāgeb','作业'],
        ['ج','نَجْم',1,'g','硬 g（静音·词中）','nagm','星星'],
        ['ج','ثَلْج',2,'g','硬 g（收尾·词尾）','talg','冰雪'],

        // 6. ح (Ḥāʾ - 咽部清擦音)
        ['ح','حِجَاب',0,'ḥe','赫·衣（哈气短音·词首）','ḥegāb','头巾'],
        ['ح','حَبِيبِي',0,'ḥa','赫（咽部哈气·词首）','ḥabībi','亲爱的'],
        ['ح','حِصَان',0,'ḥe','赫·衣（短音·词首）','ḥeṣān','马'],
        ['ح','بَحْر',1,'ḥ','咽部清擦音（静音·词中）','baḥr','海'],
        ['ح','صَبَاح',3,'ḥ','咽部清擦音（收尾·词尾）','ṣabāḥ','早晨'],
        ['ح','تُفَّاح',3,'ḥ','咽部清擦音（收尾·词尾）','toffāḥ','苹果'],

        // 7. خ (Khāʾ - 小舌清擦音)
        ['خ','خَال',0,'khā','赫（小舌摩擦拉长·词首）','khāl','舅舅'],
        ['خ','خُبْز',0,'kho','赫·乌（短音·词首）','khobz','面包'],
        ['خ','أَخْبَار',1,'kh','小舌摩擦（静音·词中）','akhbār','新闻'],
        ['خ','أُخْت',1,'kh','小舌摩擦（静音·词中）','okht','姐妹'],
        ['خ','فَرْخَة',2,'kha','小舌摩擦（短音·词中）','farkha','鸡'],
        ['خ','أَخ',1,'kh','小舌摩擦（收尾·词尾）','akh','兄弟'],
        ['خ','شَيْخ',2,'kh','小舌摩擦（收尾·词尾）','shēkh','谢赫/长者'],

        // 8. د (Dāl - 浊 d)
        ['د','دَار',0,'dā','达（拉长·词首）','dār','家宅'],
        ['د','دِيك',0,'dī','迪（拉长·词首）','dīk','公鸡'],
        ['د','هُدُوم',1,'dū','度（拉长·词中）','hodūm','衣服'],
        ['د','جَدّ',1,'dd','浊 d（双写叠音·词尾）','gadd','爷爷'],
        ['د','بَلَد',2,'d','浊 d（收尾·词尾）','balad','国家/城市'],
        ['د','وَلَد',2,'d','浊 d（收尾·词尾）','walad','男孩'],

        // 9. ذ (Dhāl - 埃及口语读 d 或 z)
        ['ذ','ذَهَب',0,'da','达（埃及口音读 d·词首）','dahab','金子'],
        ['ذ','ذَوْق',0,'zō','佐（埃及口音读 z·词首）','zōʾ','品味'],
        ['ذ','ذَيْل',0,'dē','得（埃及口音读 d·词首）','dēl','尾巴'],
        ['ذ','لَذِيذ',1,'zī','滋（美味的读 z·词中）','lazīz','美味的'],
        ['ذ','أُسْتَاذ',4,'z','浊 z（师傅/老师读 z·词尾）','ostāz','老师/师傅'],

        // 10. ر (Rāʾ - 弹舌 r)
        ['ر','رَاس',0,'rā','拉（弹舌拉长·词首）','rās','头'],
        ['ر','رُزّ',0,'ro','罗（短音弹舌·词首）','rozz','大米'],
        ['ر','شَارِع',2,'re','热（轻弹舌·词中）','shāreʿ','街道'],
        ['ر','مَرَّة',1,'rra','双写强烈弹舌（叠音·词中）','marra','一次'],
        ['ر','فَرْخَة',1,'r','单次弹舌（静音·词中）','farkha','鸡'],
        ['ر','أَخْبَار',4,'r','弹舌（收尾·词尾）','akhbār','新闻'],
        ['ر','نُور',2,'r','轻弹舌（收尾·词尾）','nūr','光'],
        ['ر','شُكْرًا',2,'ran','兰（固定表达·词尾）','shokran','谢谢'],

        // 11. ز (Zāy - 浊 z)
        ['ز','زَيْت',0,'zē','贼（单元音拉长·词首）','zēt','油'],
        ['ز','زَبَادِي',0,'za','杂（短音·词首）','zabādi','酸奶'],
        ['ز','إِزَّيَّك',1,'zza','浊 z 双写（叠音·词中）','ezzayyak','你好吗'],
        ['ز','مَوْز',2,'z','浊 z（收尾·词尾）','mōz','香蕉'],
        ['ز','رُزّ',1,'zz','浊 z（双写叠音·词尾）','rozz','大米'],

        // 12. س (Sīn - 清擦音 s)
        ['س','سُوق',0,'sū','苏（拉长·词首）','sūʾ','集市'],
        ['س','سَمَك',0,'sa','萨（短音·词首）','samak','鱼'],
        ['س','سُكَّر',0,'so','索（短音·词首）','sokkar','糖'],
        ['س','حِسَاب',1,'sā','萨（拉长·词中）','ḥesāb','账单'],
        ['س','شَمْس',2,'s','清 s（收尾·词尾）','shams','太阳'],
        ['س','فُلُوس',3,'s','清 s（收尾·词尾）','folūs','钱'],

        // 13. ش (Shīn - 舌叶清擦音 sh)
        ['ش','شَارِع',0,'shā','沙（拉长·词首）','shāreʿ','街道'],
        ['ش','شَمْس',0,'sha','沙（短音·词首）','shams','太阳'],
        ['ش','شَاي',0,'shā','沙（拉长·词首）','shāy','茶'],
        ['ش','مَاشِي',2,'shī','诗（拉长·词中）','māshi','好的'],
        ['ش','عِيش',2,'sh','诗（收尾·词尾）','ʿēsh','面包'],
        ['ش','مِش',1,'sh','诗（收尾·词尾）','mesh','不是'],

        // 14. ص (Ṣād - 重清擦音 ṣ)
        ['ص','صَبَاح',0,'ṣa','重萨（深沉粗重·词首）','ṣabāḥ','早晨'],
        ['ص','صَحّ',0,'ṣa','重萨（短音·词首）','ṣaḥḥ','对'],
        ['ص','حِصَان',1,'ṣā','重萨（拉长·词中）','ḥeṣān','马'],
        ['ص','بَصَل',1,'ṣa','重萨（短音·词中）','baṣal','洋葱'],
        ['ص','قَفَص',2,'ṣ','重萨（收尾·词尾）','ʾafaṣ','笼子'],

        // 15. ض (Ḍād - 重浊塞音 ḍ)
        ['ض','ضَهْر',0,'ḍa','重达（深粗低沉·词首）','ḍahr','中午/背部'],
        ['ض','نَضَّارَة',1,'ḍḍā','重达双写拉长（叠音·词中）','naḍḍāra','眼镜'],
        ['ض','بَيْض',2,'ḍ','重达（收尾·词尾）','bēḍ','鸡蛋'],
        ['ض','أَرْض',2,'ḍ','重达（收尾·词尾）','arḍ','大地'],

        // 16. ط (Ṭāʾ - 重清塞音 ṭ)
        ['ط','طَعْم',0,'ṭa','重塔（深粗短音·词首）','ṭaʿm','味道'],
        ['ط','طَمَاطِم',0,'ṭa','重塔（短音·词首）','ṭamāṭem','番茄'],
        ['ط','مَطَار',1,'ṭā','重塔（拉长·词中）','maṭār','机场'],
        ['ط','قُطَّة',1,'ṭṭa','重塔双写（叠音·词中）','oṭṭa','猫'],
        ['ط','بَطّ',1,'ṭṭ','重塔双写（叠音·词尾）','baṭṭ','鸭子'],

        // 17. ظ (Ẓāʾ - 埃及口语读重 ḍ 或 ẓ)
        ['ظ','ظَهْر',0,'ḍa','重达（埃及口音读 ḍ·词首）','ḍahr','背部'],
        ['ظ','نَظِيف',1,'ḍī','重迪（埃及口音读 ḍ·词中）','naḍīf','干净的'],
        ['ظ','نَظَّارَة',1,'ẓẓā','重扎双写（读 ẓ·词中）','naẓẓāra','眼镜'],
        ['ظ','حَظّ',1,'ẓẓ','重扎双写（读 ẓ·词尾）','ḥaẓẓ','运气'],

        // 18. ع (ʿAyn - 咽音)
        ['ع','عِيش',0,'ʿē','咽部收紧·长元音 ē（词首）','ʿēsh','面包'],
        ['ع','عَرَبِي',0,'ʿa','咽部收紧·短音 a（词首）','ʿarabi','阿语'],
        ['ع','بَعِيد',1,'ʿī','咽部收紧·长元音 ī（词中）','baʿīd','遥远'],
        ['ع','سَاعَة',2,'ʿa','咽部收紧·短音 a（词中）','sāʿa','小时/手表'],
        ['ع','شَارِع',3,'ʿ','咽音（收尾·词尾）','shāreʿ','街道'],
        ['ع','أُسْبُوع',4,'ʿ','咽音（收尾·词尾）','osbūʿ','星期'],

        // 19. غ (Ghayn - 浊喉擦音)
        ['غ','غَالِي',0,'ghā','小舌摩擦带声带振动（词首）','ghāli','昂贵'],
        ['غ','غَدَا',0,'gha','浊喉擦音·短音 a（词首）','ghada','午饭'],
        ['غ','شُغْل',1,'gh','浊喉擦音（静音·词中）','shoghl','工作'],
        ['غ','دِمَاغ',3,'gh','浊喉擦音（收尾·词尾）','demāgh','脑袋/心思'],

        // 20. ف (Fāʾ)
        ['ف','فَرْخَة',0,'fa','夫（短音·词首）','farkha','鸡'],
        ['ف','فُلُوس',0,'fo','佛（短音·词首）','folūs','钱'],
        ['ف','تُفَّاح',1,'ffā','夫双写拉长（叠音·词中）','toffāḥ','苹果'],
        ['ف','صَفْحَة',1,'f','夫（静音·词中）','ṣafḥa','页面'],
        ['ف','نَظِيف',3,'f','夫（收尾·词尾）','naḍīf','干净的'],
        ['ف','خَفِيف',3,'f','夫（收尾·词尾）','khafīf','轻盈的'],

        // 21. ق (Qāf - 埃及口语读喉塞音 ʾ)
        ['ق','قَلْب',0,'ʾa','喉塞后啊（开罗口音吞音·词首）','ʾalb','心'],
        ['ق','قَهْوَة',0,'ʾah','喉塞后短音（咖啡·词首）','ʾahwa','咖啡'],
        ['ق','قَلَم',0,'ʾa','喉塞后啊（铅笔·词首）','ʾalam','笔'],
        ['ق','وَقْت',1,'ʾ','声门急停（时间·词中）','waʾt','时间'],
        ['ق','سُوق',2,'ʾ','声门急停（集市·词尾）','sūʾ','集市'],

        // 22. ك (Kāf - 不送气 k)
        ['ك','كِتَاب',0,'ki','基（短音·词首）','kitāb','书'],
        ['ك','كِبِير',0,'ki','基（短音·词首）','kibīr','大的'],
        ['ك','كَلْب',0,'kal','嘎（短音·词首）','kalb','狗'],
        ['ك','سُكَّر',1,'kka','不送气 k 双写（叠音·词中）','sokkar','糖'],
        ['ك','شُكْرًا',1,'k','不送气 k（静音·词中）','shokran','谢谢'],
        ['ك','سَمَك',2,'k','不送气 k（收尾·词尾）','samak','鱼'],

        // 23. ل (Lām)
        ['ل','لَبَن',0,'la','勒（短音·词首）','laban','牛奶'],
        ['ل','لَحْم',0,'la','勒（短音·词首）','laḥm','肉'],
        ['ل','قَلَم',1,'la','勒（短音·词中）','ʾalam','笔'],
        ['ل','كُلّ',1,'ll','勒双写（叠音·词尾）','koll','全部'],
        ['ل','جَمَل',2,'l','勒（收尾·词尾）','gamal','骆驼'],
        ['ل','عَسَل',2,'l','勒（收尾·词尾）','ʿasal','蜂蜜'],

        // 24. م (Mīm)
        ['م','مَاشِي',0,'mā','马（拉长·词首）','māshi','好的'],
        ['م','مَيَّة',0,'ma','马（短音·词首）','mayya','水'],
        ['م','شَمْس',1,'m','姆（静音·词中）','shams','太阳'],
        ['م','سَمَك',1,'ma','马（短音·词中）','samak','鱼'],
        ['م','أُمّ',1,'mm','姆双写（叠音·词尾）','omm','妈妈'],
        ['م','يَوْم',2,'m','姆（收尾·词尾）','yōm','天/日子'],

        // 25. ن (Nūn)
        ['ن','نُور',0,'nū','努（拉长·词首）','nūr','光'],
        ['ن','نَظِيف',0,'na','那（短音·词首）','naḍīf','干净的'],
        ['ن','بِنْت',1,'n','恩（静音·词中）','bint','女孩'],
        ['ن','جِبْنَة',2,'na','那（短音·词中）','gibna','奶酪'],
        ['ن','تِين',2,'n','恩（收尾·词尾）','tīn','无花果'],
        ['ن','لَبَن',2,'n','恩（收尾·词尾）','laban','牛奶'],

        // 26. ه (Hāʾ - 轻清擦音)
        ['ه','هُدُوم',0,'ho','豁（短音·词首）','hodūm','衣服'],
        ['ه','هَات',0,'hā','哈（拉长·词首）','hāt','拿来'],
        ['ه','ذَهَب',1,'ha','哈（轻柔呼气·词中）','dahab','金子'],
        ['ه','قَهْوَة',1,'h','轻柔呼气（静音·词中）','ʾahwa','咖啡'],
        ['ه','وَجْه',2,'h','轻柔呼气（收尾·词尾）','wagh','脸'],
        ['ه','فِيه',2,'h','轻柔呼气（收尾·词尾）','fīh','有/在其中'],

        // 27. و (Wāw - 辅音 w / 长元音 ū / ō)
        ['و','وَاجِب',0,'wā','哇（拉长·词首）','wāgeb','作业'],
        ['و','وَقْت',0,'wa','哇（短音·词首）','waʾt','时间'],
        ['و','نُور',1,'ū','乌（长元音·词中）','nūr','光'],
        ['و','سُوق',1,'ū','乌（长元音·词中）','sūʾ','集市'],
        ['و','يَوْم',1,'ō','哦（埃及方言长音·词中）','yōm','天/日子'],
        ['و','مَوْز',1,'ō','哦（埃及方言长音·词中）','mōz','香蕉'],
        ['و','حِلْو',2,'w','乌（双唇滑音·词尾）','ḥelw','好看/甜'],
        ['و','جَوّ',1,'ww','哇双写（叠音·词尾）','gaww','天气'],

        // 28. ي (Yāʾ - 辅音 y / 长元音 ī / ē)
        ['ي','يَوْم',0,'yo','哟（辅音·词首）','yōm','天/日子'],
        ['ي','تِين',1,'ī','衣（长元音·词中）','tīn','无花果'],
        ['ي','بَيْت',1,'ē','贝（埃及方言长音·词中）','bēt','房子'],
        ['ي','عِيش',1,'ē','艾（埃及方言长音·词中）','ʿēsh','面包'],
        ['ي','شَاي',2,'y','半元音 y（收尾·词尾）','shāy','茶'],
        ['ي','حَبِيبِي',4,'ī','衣（物主我的·词尾）','ḥabībi','亲爱的'],
        ['ي','اِسْمِي',3,'ī','衣（物主我的·词尾）','ismi','我的名字']
    ];
    function graphemes(text) { return Array.from(text).reduce((a,c) => { if (/\p{Mark}/u.test(c) && a.length) a[a.length-1]+=c; else a.push(c); return a; },[]); }
    function forms(letter, mark) {
        const initial = letter + mark + (NON_JOINING.has(letter) ? '' : 'ـ');
        return [letter+mark, initial, 'ـ'+initial, 'ـ'+letter+mark];
    }
    function bank() {
        const result=[];
        LETTERS.forEach((letter,i) => {
            if (SOUNDS[i] === null) return;
            MARKS.forEach((mark,j) => {
                if (letter === 'ا' && j === 3) return;
                const unit = letter === 'ا' ? ['أَ','إِ','أُ'][j] : letter+mark;
                // Sukun is heard inside a carrier syllable, never as a silent letter.
                result.push({id:letter+':'+j,letter,unit,forms:letter==='ا'?[unit,unit,'ـ'+unit,'ـ'+unit]:forms(letter,mark),
                    read:SOUNDS[i]+VOWELS[j],hint:HINTS[i]+' · '+VOWEL_HINTS[j],audioKey:unit,
                    speech:j===3?'أَ'+unit:unit, note:j===3?'配音中的前导 a 帮助听清收尾；目标辅音本身不带元音。':'单字拼读采用基本短音；真实词中的 e / o 请听整词。'});
            });
        });
        WORDS.forEach(([letter,word,index,read,hint,roman,meaning],i) => result.push({id:'word:'+i,letter,word,index,read,hint,roman,meaning,audioKey:word,speech:word,
            note:'只判断高亮部分，配音读完整单词：'+roman+(meaning?'（'+meaning+'）':'')+'。位置不改变辅音本身；读音按这个词判断。'}));
        return result;
    }
    function shuffle(items, random=Math.random) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
    function question(pool, count=3, random=Math.random, forced=null) {
        if (!pool.length) throw new Error('请选择至少一个字母');
        const answer=forced || pool[Math.floor(random()*pool.length)];
        const seen=new Set([answer.read]);
        const candidates=[...shuffle(pool,random),...shuffle(bank(),random)].filter(item=>{if(seen.has(item.read))return false;seen.add(item.read);return true;});
        return {answer,options:shuffle([answer,...candidates.slice(0,count-1)],random)};
    }
    function limit(round) { return Math.max(2600, 10000-Math.floor(round/5)*2200); }
    const api={LETTERS,WORDS,bank,question,limit,graphemes,forms};
    if (typeof module==='object' && module.exports) { module.exports=api; return; }
    const $=id=>document.getElementById(id);
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let state={running:false,paused:false,locked:false,round:0,score:0,streak:0,correct:0,misses:[],pool:[],q:null,remaining:0,deadline:0,timer:null,next:null};
    let audio=null, audioManifest=null, audioEpoch=0;
    function getAudio(){if(!audio)audio=new Audio();return audio;}
    function unlockAudio(){try{const a=getAudio();if(!a.src||a.src.startsWith('data:')){a.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';a.play().then(()=>{a.pause();}).catch(()=>{});}}catch(_){}}
    function stopAudio(){audioEpoch++;if(audio){try{audio.pause();}catch(_){}} if(root.speechSynthesis)root.speechSynthesis.cancel();}
    async function play(answer) {
        stopAudio(); const epoch=audioEpoch;
        const local=audioManifest?.[answer.audioKey];
        const manifest=typeof speechState==='object'?speechState.manifest:null;
        const unit=manifest?.units?.[answer.word?'words':'syllables']?.egyptian?.[answer.audioKey];
        const source=local || (typeof unit==='string'?unit:unit?.audio);
        if(source){
            const a=getAudio();a.src=source;
            try {
                await a.play();
                if(epoch!==audioEpoch)return;
                $('drill-audio-status').textContent='正在播放埃及口语 AI 配音…';
                a.onended=()=>{if(epoch===audioEpoch)$('drill-audio-status').textContent='点击【重听】可再次播放';};
                return;
            } catch(err) {
                if(epoch!==audioEpoch)return;
                if(err&&(err.name==='NotAllowedError'||err.name==='AbortError')){
                    $('drill-audio-status').textContent='📱 手机自动播放受限，请点击下方【▶ 重听正确读音】收听';
                    return;
                }
            }
        }
        const voice=root.speechSynthesis?.getVoices().find(v=>v.lang.toLowerCase()==='ar-eg');
        if(voice){const u=new SpeechSynthesisUtterance(answer.speech);u.voice=voice;u.lang='ar-EG';u.rate=.8;root.speechSynthesis.speak(u);}
        else $('drill-audio-status').textContent='此题配音不可用，请根据转写复习；未使用其他口音代替。';
    }
    function clearTimers(){clearInterval(state.timer);clearTimeout(state.next);}
    function stats(){ $('drill-score').textContent=state.score; $('drill-streak').textContent=state.streak; $('drill-level').textContent=Math.floor(state.round/5)+1; $('drill-count').textContent=Math.min(state.round+1,20)+'/20'; }
    function tick(){state.remaining=Math.max(0,state.deadline-performance.now());$('drill-time').style.width=(state.remaining/limit(state.round)*100)+'%';$('drill-seconds').textContent=(state.remaining/1000).toFixed(1)+' s';if(!state.remaining) answer(-1);}
    function next(){
        clearTimers();stopAudio();
        if(state.round>=20){finish();return;}
        // Revisit a missed item after intervening questions, rather than pure random repetition.
        const due=state.misses.find(m=>m.due===state.round);
        state.q=question(state.pool,Number($('drill-options-count').value),Math.random,due?.item);
        state.locked=false;state.paused=false;
        const q=state.q.answer;
        $('drill-feedback').textContent='选择高亮字母的读音';$('drill-audio-status').textContent='作答后自动播放正确读音';
        if(q.word){
            $('drill-display').innerHTML='<div class="drill-word" lang="ar" dir="rtl">'+graphemes(q.word).map((g,i)=>i===q.index?'<span class="drill-target">'+esc(g)+'</span>':esc(g)).join('')+'</div>'
                +(q.meaning?'<div class="drill-word-meaning"><span class="drill-word-cn">'+esc(q.meaning)+'</span> · <span class="drill-word-roman">'+esc(q.roman)+'</span></div>':'')
                +'<span class="drill-caption">真实单词 · 只读高亮部分</span>';
        }
        else {
            const count=2+Math.floor(Math.random()*3), target=Math.floor(Math.random()*count);
            $('drill-display').innerHTML='<div class="drill-wave" dir="rtl">'+Array.from({length:count},(_,i)=>{
                const item=i===target?q:state.pool[Math.floor(Math.random()*state.pool.length)];
                const shape=item.forms?item.forms[Math.floor(Math.random()*4)]:item.letter;
                return '<span lang="ar" class="drill-glyph '+(i===target?'drill-target':'')+'">'+esc(shape)+'</span>';
            }).join('')+'</div><span class="drill-caption">字形辨认 · 只读高亮部分</span>';
        }
        $('drill-options').replaceChildren();state.q.options.forEach((option,i)=>{const b=document.createElement('button');b.className='drill-choice';b.innerHTML='<small>'+(i+1)+'</small><strong>'+esc(option.read)+'</strong><span>'+esc(option.hint)+'</span>';b.onclick=()=>{unlockAudio();answer(i);};$('drill-options').append(b);});
        stats();state.remaining=limit(state.round);state.deadline=performance.now()+state.remaining;tick();state.timer=setInterval(tick,50);
    }
    function answer(index){
        if(!state.running||state.locked||state.paused)return;
        state.locked=true;clearTimers();const q=state.q;const correct=index>=0&&q.options[index].read===q.answer.read;
        if(correct){state.correct++;state.streak++;state.score+=100+Math.min(100,state.streak*10)+Math.ceil(state.remaining/1000)*5;}
        else{state.streak=0;state.misses.push({item:q.answer,due:state.round+3});}
        [...$('drill-options').children].forEach((b,i)=>{b.disabled=true;if(q.options[i].read===q.answer.read)b.classList.add('correct');else if(i===index)b.classList.add('wrong');});
        $('drill-feedback').textContent=(correct?'✓ 正确！':index<0?'时间到。正确读音：':'再记一次。正确读音：')+q.answer.read+' · '+q.answer.hint+'。'+q.answer.note;
        $('drill-replay').disabled=false;$('drill-next').hidden=false;play(q.answer);stats();
        // Wrong answers wait for the learner; correct answers advance briskly.
        if(correct)state.next=setTimeout(advance,2200);
    }
    function advance(){if(!state.running||!state.locked||state.paused)return;state.round++;next();}
    function pause(){if(!state.running||state.paused)return;state.paused=true;clearTimers();stopAudio();$('drill-pause').textContent='继续';$('drill-display').classList.add('paused');$('drill-feedback').textContent='已暂停 · 点击继续后恢复';}
    function resume(){if(!state.running||!state.paused)return;state.paused=false;$('drill-display').classList.remove('paused');$('drill-pause').textContent='暂停';if(state.locked){$('drill-feedback').textContent='正确读音：'+state.q.answer.read+' · '+state.q.answer.hint+'。'+state.q.answer.note;$('drill-next').hidden=false;}else{state.deadline=performance.now()+state.remaining;state.timer=setInterval(tick,50);$('drill-feedback').textContent='选择高亮字母的读音';}}
    function start(review=false){
        unlockAudio();
        const selected=[...document.querySelectorAll('#drill-letters input:checked')].map(e=>e.value);
        const pool=review?[...new Map(state.misses.map(m=>[m.item.id,m.item])).values()]:bank().filter(q=>selected.includes(q.letter));
        if(!pool.length){$('drill-setup-status').textContent='请至少选择一个字母。';return;}
        clearTimers();stopAudio();state={running:true,paused:false,locked:false,round:0,score:0,streak:0,correct:0,misses:[],pool};
        $('letter-drill-root').classList.add('in-game');$('drill-setup').hidden=true;$('drill-results').hidden=true;$('drill-arena').hidden=false;$('drill-display').classList.remove('paused');next();$('letter-drill-root').scrollIntoView({block:'start'});
    }
    function finish(){$('letter-drill-root').classList.remove('in-game');clearTimers();stopAudio();state.running=false;$('drill-arena').hidden=true;$('drill-results').hidden=false;$('drill-summary').textContent='本轮 '+state.score+' 分 · 正确 '+state.correct+'/20 · '+Math.round(state.correct/20*100)+'%';
        const misses=[...new Map(state.misses.map(m=>[m.item.id,m.item])).values()];
        $('drill-misses').textContent=misses.length?'再练这些：'+misses.map(q=>(q.word||q.unit)+' → '+q.read).join('；'):'全部答对！下次试着加入几个新字母。';$('drill-review').hidden=!misses.length;}
    function init(){
        $('letter-drill-root').innerHTML=`<div class="drill-heading"><span class="drill-kicker">CAIRO · LETTER SPRINT</span><h2>字母抽查</h2><p>看清字形，听懂读音。每轮 20 题，每 5 题加速。</p></div>
        <div id="drill-setup" class="drill-panel"><h3>今天练哪些字母？</h3><p>点选一个或多个字母。初学建议从 ب · ت · ج 开始。</p><div class="drill-toolbar"><button id="drill-all">全选</button><button id="drill-clear">清空</button><label>选择方式 <select id="drill-selection"><option value="multi">多选</option><option value="single">单选</option></select></label><label>选项 <select id="drill-options-count"><option value="3">3 个</option><option value="2">2 个</option></select></label></div><div id="drill-letters" class="drill-letters"></div><p class="drill-note">包含首、中、尾字形，短音、静符、长音、叠音与固定表达的 -an。ث / ذ / ظ 按具体词考察。汉语谐音不是精确音标。</p><p id="drill-setup-status" role="status"></p><button id="drill-start" class="drill-primary">开始闯关 →</button></div>
        <div id="drill-arena" class="drill-panel" hidden><div class="drill-hud"><span>关卡 <b id="drill-level">1</b></span><span>得分 <b id="drill-score">0</b></span><span>连击 <b id="drill-streak">0</b></span><span id="drill-count"></span><button id="drill-pause">暂停</button><button id="drill-exit">结束本轮</button></div><div class="drill-clock"><div id="drill-time"></div></div><div id="drill-seconds" aria-hidden="true"></div><div id="drill-display"></div><div id="drill-options" class="drill-options"></div><p id="drill-feedback" role="status" aria-live="polite"></p><div class="drill-toolbar"><button id="drill-replay">▶ 重听正确读音</button><button id="drill-next">下一题 →</button></div><p id="drill-audio-status" class="drill-note"></p><p class="drill-note">键盘 1 / 2 / 3 作答 · 空格暂停 · 答错后先复习，再点下一题</p></div>
        <div id="drill-results" class="drill-panel" hidden><h3>本轮完成</h3><p id="drill-summary"></p><p id="drill-misses"></p><div class="drill-toolbar"><button id="drill-review" class="drill-primary">错题专项再练</button><button id="drill-reset">重新选字母</button></div></div>`;
        LETTERS.forEach(letter=>{const label=document.createElement('label');label.innerHTML='<input type="checkbox" value="'+letter+'" '+('بتج'.includes(letter)?'checked':'')+'><span lang="ar">'+letter+'</span>';label.querySelector('input').onchange=e=>{if($('drill-selection').value==='single'&&e.target.checked)document.querySelectorAll('#drill-letters input').forEach(input=>{if(input!==e.target)input.checked=false;});};$('drill-letters').append(label);});
        $('drill-all').onclick=()=>{$('drill-selection').value='multi';document.querySelectorAll('#drill-letters input').forEach(e=>e.checked=true);};
        $('drill-clear').onclick=()=>document.querySelectorAll('#drill-letters input').forEach(e=>e.checked=false);
        $('drill-selection').onchange=()=>{if($('drill-selection').value==='single'){let found=false;document.querySelectorAll('#drill-letters input').forEach(e=>{if(e.checked&&!found)found=true;else e.checked=false;});}};
        $('drill-start').onclick=()=>start();$('drill-review').onclick=()=>start(true);
        const reset=()=>{$('letter-drill-root').classList.remove('in-game');clearTimers();stopAudio();state.running=false;$('drill-setup').hidden=false;$('drill-results').hidden=true;$('drill-arena').hidden=true;};
        $('drill-reset').onclick=reset;$('drill-exit').onclick=reset;
        $('drill-pause').onclick=()=>state.paused?resume():pause();$('drill-next').onclick=advance;$('drill-replay').onclick=()=>{unlockAudio();play(state.q.answer);};
        document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
        root.addEventListener('pagehide',()=>{clearTimers();stopAudio();});
        document.addEventListener('keydown',e=>{if(!state.running||!$('tab-letter-drill').classList.contains('active')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.repeat)return;if(e.code==='Space'){e.preventDefault();state.paused?resume():pause();}else if(/^[123]$/.test(e.key)){const index=Number(e.key)-1;if(index<state.q.options.length)answer(index);}});
        fetch('audio/drill-manifest.json?v=20261003-1').then(r=>r.ok?r.json():null).then(m=>audioManifest=m).catch(()=>{});
    }
    root.letterDrill={init,pause,...api};
})(typeof window==='undefined'?globalThis:window);
