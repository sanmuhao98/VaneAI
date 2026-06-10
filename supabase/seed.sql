-- Seed data — local + staging only. Production seeds are forbidden (docs/03-environments.md).

-- Models
-- 主 provider：火山方舟豆包 Seedream（ADR-017）。provider_model 填方舟控制台的
-- Model ID（或 Endpoint ID）——开通模型服务后如有出入直接改这行即可，无需改代码。
-- config.watermark：false 关闭右下角"AI生成"水印（合规要求变化时改回 true）。
insert into public.models (id, display_name, type, provider, provider_model, credits_cost, config, sort_order)
values
  ('doubao-seedream-5-lite', 'Doubao Seedream 5.0 Lite', 'text_to_image', 'seedream', 'doubao-seedream-5-0-lite-260128', 1,
   '{"watermark": true}', 0),
  ('fal-flux-schnell', 'FLUX schnell（备选）', 'text_to_image', 'fal', 'fal-ai/flux/schnell', 1,
   '{"default_width":1024,"default_height":1024}', 10)
on conflict (id) do nothing;

-- Templates (base_prompt 含 {subject} 占位；用户永不可见)
-- 推荐尺寸对齐 Seedream 2K 档（像素模式总像素下限 2560x1440，1024 档不可用）。
insert into public.templates
  (slug, title, theme, reference_image_path, sample_output_paths, base_prompt, negative_prompt,
   model_id, recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order)
values
  ('game-hero', '游戏角色概念图', 'game_character', 'game-hero.svg', array['game-hero.svg'],
   'concept art of {subject}, heroic fantasy game character, dramatic rim lighting, highly detailed, artstation trending',
   'blurry, low quality, watermark, text',
   'doubao-seedream-5-lite', 2048, 2048, 1, '例如：手持长剑的女骑士', 0),
  ('blind-box', '盲盒手办风', 'blind_box', 'blind-box.svg', array['blind-box.svg'],
   'cute chibi blind box figure of {subject}, soft pastel colors, studio product photo, 3d render, clean background',
   'blurry, low quality, watermark, text',
   'doubao-seedream-5-lite', 2048, 2048, 1, '例如：戴帽子的柴犬', 1)
on conflict (slug) do nothing;
