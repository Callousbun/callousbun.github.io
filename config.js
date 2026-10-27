/* ===== ВСЕ НАСТРОЙКИ САЙТА ЗДЕСЬ =====
   Тексты, контакты, ссылки, пути к картинкам и список работ.
   Кавычки и запятые менять осторожно. */
window.SITE = {
  defaultLang: "en",

  // Минимальный масштаб всех PNG интерфейса (кроме галереи и нижнего арта)
  minUiScale: 2,

  // Контакты-иконки: до какой ширины экрана (CSS-пиксели) экран считается "узким".
  // На узком экране подписи под иконками вдвое меньше, а расстояние между иконками --contacts-gap-compact (style.css).
  contactsNarrow: 800,
  contactIconBox: 192,     // максимальный размер иконки контакта (CSS-пиксели)
  contactsMinScale: 2,    // минимальный масштаб иконок контактов (они могут быть меньше 2x, чтобы влезть в один ряд)

  // Сетка шрифта в пикселях (у Pixeloid Sans - 9). Размеры текста подгоняются под неё на любом экране.
  fontGrid: 9,

  // Названия языков (используются как подпись для экранных читалок)
  langNames: { en: "ENG", ru: "RU" },

  // Картинки интерфейса (замените файлы или поменяйте пути).
  // У кнопок три файла: normal - обычное, hover - наведение, active - нажатие.
  // Для кнопки выбранного языка всегда показывается файл active.
  // Все три файла одной кнопки должны быть одного размера.
  images: {
    avatar: "assets/ui/avatar.png",
    status: "assets/ui/status.gif",
    footer: "assets/footer/footer.png",

    // Кнопки переключения языка
    lang: {
      en: { normal: "assets/ui/lang-en.png", hover: "assets/ui/lang-en-hover.png", active: "assets/ui/lang-en-active.png" },
      ru: { normal: "assets/ui/lang-ru.png", hover: "assets/ui/lang-ru-hover.png", active: "assets/ui/lang-ru-active.png" }
    },

    // Стрелки в режиме просмотра
    arrows: {
      prev: { normal: "assets/ui/arrow-prev.png", hover: "assets/ui/arrow-prev-hover.png", active: "assets/ui/arrow-prev-active.png" },
      next: { normal: "assets/ui/arrow-next.png", hover: "assets/ui/arrow-next-hover.png", active: "assets/ui/arrow-next-active.png" }
    },

    // Кнопка "закрыть" в режиме просмотра
    close: { normal: "assets/ui/close.png", hover: "assets/ui/close-hover.png", active: "assets/ui/close-active.png" },

    // Ползунок масштаба. track и fill - маленькие плитки, которые повторяются по горизонтали
    // (плитка track задаёт шаг длины дорожки). thumb - бегунок.
    slider: {
      track: "assets/ui/slider-track.png",
      fill: "assets/ui/slider-fill.png",
      thumb: "assets/ui/slider-thumb.png"
    }
  },


  // ----- Рамки (набор из 9 тайлов) -----
  // scale - масштаб тайлов (целое число, не меньше minUiScale).
  // borderWidth - толщина рамки в пикселях исходного тайла: на столько внутрь отступает содержимое
  //   (null = толщина целого тайла).
  // variantWeights - вероятности вариаций по порядку в списке (в процентах): 1-я 70%, 2-я 20%, 3-я 10%.
  //   Если вариаций в списке больше, чем чисел здесь, у лишних вес как у последнего числа.
  // padding - дополнительный отступ содержимого от рамки (CSS-пиксели).
  // В каждой позиции - список файлов-вариаций. Если файлов несколько, для каждой клетки при
  // загрузке страницы выбирается случайный. Чтобы добавить вариацию, положите файл и впишите путь в список.
  // Все тайлы набора должны быть одного размера.
  frames: {
    scale: 4,
    variantWeights: [45, 35, 15],
    welcome: {
      borderWidth: 12, padding: 8,
      tiles: {
      topLeft: ["assets/ui/frames/top-left-1.png", "assets/ui/frames/top-left-2.png", "assets/ui/frames/top-left-3.png", "assets/ui/frames/top-left-4.png"],
      top: ["assets/ui/frames/top-1.png", "assets/ui/frames/top-2.png", "assets/ui/frames/top-3.png", "assets/ui/frames/top-4.png"],
      topRight: ["assets/ui/frames/top-right-1.png", "assets/ui/frames/top-right-2.png", "assets/ui/frames/top-right-3.png", "assets/ui/frames/top-right-4.png"],
      left: ["assets/ui/frames/left-1.png", "assets/ui/frames/left-2.png", "assets/ui/frames/left-3.png", "assets/ui/frames/left-4.png"],
      center: ["assets/ui/frames/center-1.png", "assets/ui/frames/center-2.png", "assets/ui/frames/center-3.png", "assets/ui/frames/center-4.png", "assets/ui/frames/center-5.png", "assets/ui/frames/center-6.png", "assets/ui/frames/center-7.png", "assets/ui/frames/center-8.png"],
      right: ["assets/ui/frames/right-1.png", "assets/ui/frames/right-2.png", "assets/ui/frames/right-3.png", "assets/ui/frames/right-4.png"],
      bottomLeft: ["assets/ui/frames/bottom-left-1.png", "assets/ui/frames/bottom-left-2.png", "assets/ui/frames/bottom-left-3.png", "assets/ui/frames/bottom-left-4.png"],
      bottom: ["assets/ui/frames/bottom-1.png", "assets/ui/frames/bottom-2.png", "assets/ui/frames/bottom-3.png", "assets/ui/frames/bottom-4.png"],
      bottomRight: ["assets/ui/frames/bottom-right-1.png", "assets/ui/frames/bottom-right-2.png", "assets/ui/frames/bottom-right-3.png", "assets/ui/frames/bottom-right-4.png"]
      }
    },
    social: {
      layout: "row",
      borderWidth: 12, padding: 4, paddingY: 0,
      tiles: {
        left:   ["assets/ui/frames/s-left-1.png", "assets/ui/frames/s-left-2.png", "assets/ui/frames/s-left-3.png"],
        center: ["assets/ui/frames/s-center-1.png", "assets/ui/frames/s-center-2.png", "assets/ui/frames/s-center-3.png"],
        right:  ["assets/ui/frames/s-right-1.png", "assets/ui/frames/s-right-2.png", "assets/ui/frames/s-right-3.png"]
      }
    }
  },

  // Заголовок над приветствием (пустая строка "" скроет его)
  title: { en: "Pixel Artist Portfolio", ru: "Портфолио пиксель-артиста" },

  // Приветствие
  welcome: {
    en: "Hi! I'm a pixel artist. Take a look at my work below. I'm open for commissions. ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA ABOBA",
    ru: "Привет! Я пиксель-артист. Посмотрите мои работы ниже. Я открыт для заказов."
  },

  // Остальные тексты интерфейса
  strings: {
    en: { copyHint: "(click to copy)", copied: "Copied!", copyFailed: "Select and copy manually",
          close: "Close", prev: "Previous work", next: "Next work", zoom: "Zoom", status: "Open for commissions", gallery: "Gallery", viewer: "Image viewer" },
    ru: { copyHint: "(нажмите, чтобы скопировать)", copied: "Скопировано!", copyFailed: "Выделите и скопируйте вручную",
          close: "Закрыть", prev: "Предыдущая работа", next: "Следующая работа", zoom: "Масштаб", status: "Открыт для заказов", gallery: "Галерея", viewer: "Просмотр изображения" }
  },

  // Контакты (иконка: normal / hover / active). type "copy" - копирует text в буфер, type "link" - открывает url в новой вкладке
  contacts: [
    { icon: { normal: "assets/ui/icon-gmail.png", hover: "assets/ui/icon-gmail-hover.png", active: "assets/ui/icon-gmail-active.png" }, type: "copy", text: "callousbun@gmail.com", label: "callousbun\n@gmail.com",
      title: { en: "Copy e-mail", ru: "Скопировать почту" } },
    { icon: { normal: "assets/ui/icon-discord.png", hover: "assets/ui/icon-discord-hover.png", active: "assets/ui/icon-discord-active.png" }, type: "link", text: "callous_bun", url: "https://discord.com/users/callous_bun",
      title: { en: "Open Discord profile", ru: "Открыть профиль Discord" } },
    { icon: { normal: "assets/ui/icon-telegram.png", hover: "assets/ui/icon-telegram-hover.png", active: "assets/ui/icon-telegram-active.png" }, type: "link", text: "@callousbun", url: "https://t.me/callousbun",
      title: { en: "Open Telegram profile", ru: "Открыть профиль Telegram" } }
  ],

  // Работы. Чтобы добавить работу, скопируйте один блок { ... }, и поменяйте данные.
  // format: "png" или "gif" (для справки)
  gallery: [
	/*2*/	  
    { file: "assets/gallery/2.gif", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*1*/
    { file: "assets/gallery/1.gif", format: "gif",
      desc: { en: "Test image 2: a small cross.", ru: "Тестовое изображение 2: маленький крестик." } },
	/*3*/	  
    { file: "assets/gallery/3.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*4*/	  
    { file: "assets/gallery/4.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*5*/	  
    { file: "assets/gallery/5.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*6*/	  
    { file: "assets/gallery/6.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*7*/	  
    { file: "assets/gallery/7.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*8*/	  
    { file: "assets/gallery/8.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*15*/	  
    { file: "assets/gallery/15.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },
	/*21*/	  
    { file: "assets/gallery/21.png", format: "png",
      desc: { en: "Test image 1: a diagonal line.", ru: "Тестовое изображение 1: диагональная линия." } },

  ]
};
