# Публикация на GitHub Pages

Репозиторий содержит исходники и готовое приложение в `docs/`. Локальные профили,
попытки и пользовательские слова из IndexedDB не входят в репозиторий.

Приложение: **https://igogimbro.github.io/slovosad/**

Исходники: **https://github.com/IgogimBro/slovosad**

## Первая публикация

1. Создайте публичный репозиторий `slovosad` и загрузите файлы проекта.
2. В репозитории откройте **Settings → Pages**.
3. В **Build and deployment → Source** выберите **Deploy from a branch**.
4. Выберите ветку **main**, папку **/docs** и нажмите **Save**.
5. Дождитесь завершения публикации и откройте ссылку **Visit site**.

Файл `docs/.nojekyll` отключает обработку готовой сборки через Jekyll. Относительные
пути и HashRouter позволяют запускать приложение из подпапки репозитория.
Сайт будет доступен по HTTPS; GitHub Pages публикует его для всех посетителей.

## Обновление приложения

Нужны Node.js 22+ и pnpm 11. После изменения исходников:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build:pages
git add .
git commit -m "Update Slovosad"
git push
```

`build:pages` заново собирает приложение и заменяет содержимое `docs/`. GitHub
Pages публикует его после push в main. В уже установленном приложении новую
версию применяют кнопкой обновления на главном экране.

## Открытие с телефона

Откройте опубликованный HTTPS-адрес в Safari. Через **Поделиться → На экран Домой**
добавьте приложение. Дождитесь надписи «Офлайн-версия готова», затем откройте
приложение ещё раз. История телефона хранится на телефоне; история компьютера
автоматически не переносится. Доступность русского голоса зависит от устройства.

Документация: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
[установка на iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios).
