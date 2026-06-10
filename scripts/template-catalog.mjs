// 首批模板目录（W5 铺设）。base_prompt 含 {subject} 占位，用户永不可见（ADR-016）。
// refSubject/sampleSubject 仅用于生成参考图/示范产出（不同主体演示"换主体同风格"）。

const NEG = 'blurry, low quality, watermark, text, deformed'

export const TEMPLATES = [
  // ── 游戏角色概念（16）──────────────────────────────────────────────
  {
    slug: 'game-hero', title: '史诗奇幻骑士', theme: 'game_character',
    base_prompt: 'concept art of {subject}, heroic fantasy game character, dramatic rim lighting, highly detailed, artstation trending',
    placeholder: '例如：手持长剑的女骑士', refSubject: '银甲红披风的女骑士', sampleSubject: '持战斧的兽人酋长',
  },
  {
    slug: 'game-cyberpunk', title: '赛博朋克角色', theme: 'game_character',
    base_prompt: 'character concept art of {subject}, cyberpunk style, neon-lit rainy city backdrop, holographic UI elements, chrome and leather outfit, cinematic lighting, ultra detailed',
    placeholder: '例如：机械义肢的女黑客', refSubject: '机械义肢的女黑客', sampleSubject: '霓虹面具的街头武士',
  },
  {
    slug: 'game-xianxia', title: '国风仙侠立绘', theme: 'game_character',
    base_prompt: 'full body game character illustration of {subject}, Chinese xianxia fantasy style, flowing silk robes, ethereal clouds and mountain mist, elegant ink-wash color palette, intricate details',
    placeholder: '例如：御剑的白衣剑仙', refSubject: '御剑的白衣剑仙', sampleSubject: '执伞的红衣女妖',
  },
  {
    slug: 'game-pixel', title: '像素风角色', theme: 'game_character',
    base_prompt: 'pixel art game sprite of {subject}, 32-bit retro RPG style, vibrant colors, idle pose, clean pixel work, dark dungeon background',
    placeholder: '例如：举盾的小骑士', refSubject: '举盾的小骑士', sampleSubject: '施法的精灵法师',
  },
  {
    slug: 'game-anime', title: '二次元立绘', theme: 'game_character',
    base_prompt: 'anime game character full-body illustration of {subject}, cel shading, vivid colors, dynamic pose, clean lineart, white gradient background, gacha game splash art style',
    placeholder: '例如：双马尾魔法少女', refSubject: '双马尾魔法少女', sampleSubject: '黑色风衣的冷面剑士',
  },
  {
    slug: 'game-mecha', title: '机甲驾驶员', theme: 'game_character',
    base_prompt: 'concept art of {subject} as a mecha pilot with giant robot armor, sci-fi hangar background, glowing energy core, hard surface design, dramatic low angle',
    placeholder: '例如：短发机甲女飞行员', refSubject: '短发机甲女飞行员', sampleSubject: '白发少年王牌驾驶员',
  },
  {
    slug: 'game-wasteland', title: '废土幸存者', theme: 'game_character',
    base_prompt: 'post-apocalyptic game character concept of {subject}, wasteland survivor gear, gas mask details, rusted metal and worn leather, sandstorm atmosphere, gritty realistic style',
    placeholder: '例如：背狙击枪的独行者', refSubject: '背狙击枪的独行者', sampleSubject: '带机械犬的拾荒少女',
  },
  {
    slug: 'game-gothic', title: '哥特暗黑风', theme: 'game_character',
    base_prompt: 'dark gothic game character art of {subject}, victorian gothic attire, pale moonlight, ornate silver accessories, bats and fog, dark souls inspired atmosphere',
    placeholder: '例如：执银杖的吸血鬼伯爵', refSubject: '执银杖的吸血鬼伯爵', sampleSubject: '黑纱礼服的幽灵新娘',
  },
  {
    slug: 'game-norse', title: '北欧神话战士', theme: 'game_character',
    base_prompt: 'norse mythology game character concept of {subject}, viking runes glowing, fur and bronze armor, snowstorm fjord backdrop, epic god-like presence',
    placeholder: '例如：双手战锤的狂战士', refSubject: '双手战锤的狂战士', sampleSubject: '冰霜女武神',
  },
  {
    slug: 'game-wuxia', title: '武侠水墨', theme: 'game_character',
    base_prompt: 'wuxia martial artist {subject}, Chinese ink painting style game art, dynamic sword stance, splashing ink strokes, minimal color accent, rice paper texture',
    placeholder: '例如：竹林中的盲剑客', refSubject: '竹林中的盲剑客', sampleSubject: '雪夜独行的刀客',
  },
  {
    slug: 'game-magic-academy', title: '魔法学院学生', theme: 'game_character',
    base_prompt: 'game character design of {subject} as a magic academy student, wizard robe with house emblem, floating spellbook and glowing runes, warm library background, painterly style',
    placeholder: '例如：抱猫的天才学妹', refSubject: '抱猫的天才学妹', sampleSubject: '戴圆眼镜的炼金学长',
  },
  {
    slug: 'game-steampunk', title: '蒸汽朋克发明家', theme: 'game_character',
    base_prompt: 'steampunk game character concept of {subject}, brass goggles and clockwork gadgets, steam pipes background, victorian workshop, warm copper tones',
    placeholder: '例如：机械臂的天才少女', refSubject: '机械臂的天才少女', sampleSubject: '驾驶飞艇的老船长',
  },
  {
    slug: 'game-space-opera', title: '星际指挥官', theme: 'game_character',
    base_prompt: 'space opera game character of {subject}, sleek sci-fi commander uniform, starship bridge backdrop, holographic star map, cinematic blue lighting',
    placeholder: '例如：白制服的舰队司令', refSubject: '白制服的舰队司令', sampleSubject: '异星外交官',
  },
  {
    slug: 'game-chibi', title: 'Q版游戏角色', theme: 'game_character',
    base_prompt: 'chibi game character of {subject}, super deformed proportions, big sparkling eyes, casual RPG outfit, cheerful colors, mobile game style',
    placeholder: '例如：背大剑的小勇者', refSubject: '背大剑的小勇者', sampleSubject: '拿法杖的小魔女',
  },
  {
    slug: 'game-monster', title: '怪物图鉴', theme: 'game_character',
    base_prompt: 'fantasy creature design of {subject}, monster manual illustration style, detailed anatomy, scales and claws, neutral parchment background, professional game bestiary art',
    placeholder: '例如：双头岩浆龙', refSubject: '双头岩浆龙', sampleSubject: '森林树人长老',
  },
  {
    slug: 'game-cthulhu', title: '克苏鲁调查员', theme: 'game_character',
    base_prompt: 'cosmic horror game character of {subject}, 1920s investigator attire, eldritch tentacle shadows, sickly green fog, lovecraftian atmosphere, dramatic chiaroscuro',
    placeholder: '例如：提油灯的老侦探', refSubject: '提油灯的老侦探', sampleSubject: '抱古籍的修女学者',
  },

  // ── 盲盒手办风（16）────────────────────────────────────────────────
  {
    slug: 'blind-box', title: '经典奶油盲盒', theme: 'blind_box',
    base_prompt: 'cute chibi blind box figure of {subject}, soft pastel colors, studio product photo, 3d render, clean background',
    placeholder: '例如：戴帽子的柴犬', refSubject: '戴贝雷帽的水豚', sampleSubject: '戴小皇冠的柯基',
  },
  {
    slug: 'bb-macaron', title: '马卡龙糖果系', theme: 'blind_box',
    base_prompt: 'cute chibi blind box figure of {subject}, macaron candy color palette, glossy smooth surface, dessert accessories, pastel pink studio background, 3d render',
    placeholder: '例如：抱草莓的小熊', refSubject: '抱草莓的小熊', sampleSubject: '顶着甜甜圈的兔子',
  },
  {
    slug: 'bb-plush', title: '毛绒材质', theme: 'blind_box',
    base_prompt: 'blind box figure of {subject} in fluffy plush texture, soft fuzzy material, kawaii expression, cozy warm lighting, clean studio shot, 3d render',
    placeholder: '例如：围围巾的企鹅', refSubject: '围围巾的企鹅', sampleSubject: '穿毛衣的小羊驼',
  },
  {
    slug: 'bb-jelly', title: '果冻半透明', theme: 'blind_box',
    base_prompt: 'translucent jelly material blind box figure of {subject}, gummy candy texture, light passing through, glossy highlights, mint background, 3d render',
    placeholder: '例如：果冻小恐龙', refSubject: '果冻小恐龙', sampleSubject: '半透明的小章鱼',
  },
  {
    slug: 'bb-guochao', title: '国潮风', theme: 'blind_box',
    base_prompt: 'chinese guochao style blind box figure of {subject}, traditional opera costume elements, auspicious cloud patterns, red and gold palette, festive studio shot, 3d render',
    placeholder: '例如：舞狮的小老虎', refSubject: '舞狮的小老虎', sampleSubject: '穿戏服的熊猫花旦',
  },
  {
    slug: 'bb-zodiac', title: '星空主题', theme: 'blind_box',
    base_prompt: 'celestial zodiac themed blind box figure of {subject}, starry translucent cape, tiny constellation crown, deep blue and gold, dreamy glow, 3d render',
    placeholder: '例如：摘星星的小鹿', refSubject: '摘星星的小鹿', sampleSubject: '抱月亮的小狐狸',
  },
  {
    slug: 'bb-food', title: '美食拟人', theme: 'blind_box',
    base_prompt: 'food-themed blind box figure of {subject} dressed as a dessert chef, wearing food hat, miniature kitchen props, cream tones, 3d render',
    placeholder: '例如：戴厨师帽的仓鼠', refSubject: '戴厨师帽的仓鼠', sampleSubject: '端蛋糕的小浣熊',
  },
  {
    slug: 'bb-christmas', title: '圣诞限定', theme: 'blind_box',
    base_prompt: 'christmas edition blind box figure of {subject}, santa hat and scarf, tiny gift box, snow dusted base, warm fairy lights bokeh, 3d render',
    placeholder: '例如：抱礼物的北极熊', refSubject: '抱礼物的北极熊', sampleSubject: '挂彩灯的麋鹿',
  },
  {
    slug: 'bb-sakura', title: '樱花和风', theme: 'blind_box',
    base_prompt: 'japanese sakura themed blind box figure of {subject}, kimono with cherry blossom pattern, falling petals, soft pink gradient background, 3d render',
    placeholder: '例如：穿和服的小猫', refSubject: '穿和服的小猫', sampleSubject: '撑油纸伞的白兔',
  },
  {
    slug: 'bb-ocean', title: '海洋生物', theme: 'blind_box',
    base_prompt: 'ocean themed blind box figure of {subject}, wearing cute diving helmet, bubbles and coral base, aqua blue palette, 3d render',
    placeholder: '例如：戴潜水盔的海獭', refSubject: '戴潜水盔的海獭', sampleSubject: '骑海马的小美人鱼',
  },
  {
    slug: 'bb-retro-toy', title: '复古铁皮玩具', theme: 'blind_box',
    base_prompt: 'retro tin toy style blind box figure of {subject}, vintage wind-up key on back, slightly worn paint texture, nostalgic warm tones, 3d render',
    placeholder: '例如：发条小机器人', refSubject: '发条小机器人', sampleSubject: '铁皮小火车司机熊',
  },
  {
    slug: 'bb-astronaut', title: '太空宇航员', theme: 'blind_box',
    base_prompt: 'astronaut blind box figure of {subject}, tiny spacesuit with clear helmet, moon surface base, star field backdrop, 3d render',
    placeholder: '例如：登月的小仓鼠', refSubject: '登月的小仓鼠', sampleSubject: '飘在太空的小猫',
  },
  {
    slug: 'bb-forest', title: '森林精灵', theme: 'blind_box',
    base_prompt: 'forest spirit blind box figure of {subject}, leaf cloak and acorn hat, mushroom base with fireflies, mori kei palette, 3d render',
    placeholder: '例如：戴橡果帽的刺猬', refSubject: '戴橡果帽的刺猬', sampleSubject: '披树叶斗篷的小鹿',
  },
  {
    slug: 'bb-crystal', title: '水晶质感', theme: 'blind_box',
    base_prompt: 'crystal gemstone blind box figure of {subject}, faceted translucent body, prismatic light refraction, elegant dark backdrop, 3d render',
    placeholder: '例如：水晶独角兽', refSubject: '水晶独角兽', sampleSubject: '紫水晶小龙',
  },
  {
    slug: 'bb-mecha-cute', title: '机甲萌宠', theme: 'blind_box',
    base_prompt: 'cute mecha armor blind box figure of {subject}, pastel robot suit pieces, tiny LED details, clean white tech background, 3d render',
    placeholder: '例如：穿机甲的橘猫', refSubject: '穿机甲的橘猫', sampleSubject: '装推进器的柴犬',
  },
  {
    slug: 'bb-bread', title: '烘焙小队', theme: 'blind_box',
    base_prompt: 'freshly baked bread themed blind box figure of {subject}, golden crust texture body, flour dust, bakery wooden board base, cozy morning light, 3d render',
    placeholder: '例如：牛角包小猫', refSubject: '牛角包小猫', sampleSubject: '吐司面包小熊',
  },
]

export const NEGATIVE_PROMPT = NEG
export const MODEL_ROW_ID = 'doubao-seedream-5-lite'
