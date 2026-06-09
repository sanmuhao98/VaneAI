-- Seed data — local + staging only. Production seeds are forbidden (docs/03-environments.md).

-- Models
insert into public.models (id, display_name, type, provider, provider_model, credits_cost, config, sort_order)
values
  ('fal-flux-schnell', 'FLUX schnell', 'text_to_image', 'fal', 'fal-ai/flux/schnell', 1,
   '{"default_width":1024,"default_height":1024}', 0)
on conflict (id) do nothing;

-- Templates (base_prompt 含 {subject} 占位；用户永不可见)
insert into public.templates
  (slug, title, theme, reference_image_path, sample_output_paths, base_prompt, negative_prompt,
   model_id, recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order)
values
  ('game-hero', '游戏角色概念图', 'game_character', 'game-hero.svg', array['game-hero.svg'],
   'concept art of {subject}, heroic fantasy game character, dramatic rim lighting, highly detailed, artstation trending',
   'blurry, low quality, watermark, text',
   'fal-flux-schnell', 1024, 1024, 1, '例如：手持长剑的女骑士', 0),
  ('blind-box', '盲盒手办风', 'blind_box', 'blind-box.svg', array['blind-box.svg'],
   'cute chibi blind box figure of {subject}, soft pastel colors, studio product photo, 3d render, clean background',
   'blurry, low quality, watermark, text',
   'fal-flux-schnell', 1024, 1024, 1, '例如：戴帽子的柴犬', 1)
on conflict (slug) do nothing;
