# Иконка и графические ассеты

## Master Icon — обязательно

Создать **ОДНУ** PNG-иконку размером **1024×1024 px**:

- ✅ Квадрат, без скруглений (Apple/Google сами добавят)
- ✅ Без альфа-канала (Apple **отклоняет** альфу)
- ✅ Без teasing — никакого «coming soon», без полупрозрачности
- ✅ Цветовое пространство sRGB
- ✅ Максимум 1 МБ

Положить в:
```
mobile/apps/client/assets/icon.png   (master, 1024×1024)
mobile/apps/client/assets/adaptive-icon.png  (foreground для Android, 1024×1024)
```

То же для драйвера: `mobile/apps/driver/assets/icon.png` и т.д.

Expo автоматически генерирует все нужные размеры (60/76/120/152/180/etc) из master'a.

## Что нарисовать

**Идея**: brand teal "A" (Alif initial) на белом фоне с aqua-glow.

Размеры:
- Logo mark — 60% от ширины (614 px при 1024)
- Padding со всех сторон — 20% (205 px)

**Цвета**:
- Foreground: `#14B8A6` (brand teal)
- Background: `#FFFFFF` (чистый белый)

Если у тебя нет дизайнера — могу сгенерировать через Figma шаблон. Альтернатива:
- [iOS Icon Maker](https://appicon.co) — загружаешь master 1024 и он генерит весь набор
- [App Icon Generator](https://www.appicon.build)

## Adaptive Icon (Android only)

Android требует **отдельный foreground** который накладывается на
динамический background. У нас уже стоит:

```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#FFFFFF"
  }
}
```

`adaptive-icon.png` должен иметь:
- 1024×1024 PNG
- Реальный контент **только в центральных 660×660 px** (Android crop'ает)
- Прозрачный фон (альфа) — да, тут можно

## Notification Icon (Android)

Android требует **monochrome** иконку для уведомлений (Material design).
Положить:
```
mobile/apps/client/assets/notification-icon.png    (96×96, белая на прозрачном)
mobile/apps/driver/assets/notification-icon.png
```

В `app.json` у нас уже стоит `expo-notifications.color: "#14B8A6"` —
Android применит этот цвет как tint.

## Splash Screen

Уже есть, не трогать:
```json
"expo-splash-screen": {
  "image": "./assets/alif-lockup.png",
  ...
}
```

## Feature Graphic (Google Play)

Google Play требует **1024×500 px** баннер для store-страницы.

**Что нарисовать**:
- Brand teal gradient
- Текст «Alif Taxi» крупным wordmark'ом
- Подзаголовок «Такси в Таласской области»
- Опционально — мини-иконка машинки или пина

Положить в:
```
mobile/docs/store-submission/feature-graphic.png
```

Загружать в Play Console → Store listing → Graphic assets.

## App Preview Videos (опционально)

Apple/Google поддерживают 15-30 сек видео на странице приложения.
**Сильно** улучшает install rate, но не обязательно для первого релиза.

Если делать — снять ту же демо-сессию (35 сек), отредактировать
в 15 сек ключевыми моментами:
- Логин (1 сек)
- Заказ (2 сек)
- Водитель принял (2 сек)
- Маршрут на карте (3 сек)
- Прибыл (2 сек)
- Поездка завершена + 5 звёзд (3 сек)
- Закрывающий wordmark «Alif Taxi» (2 сек)
