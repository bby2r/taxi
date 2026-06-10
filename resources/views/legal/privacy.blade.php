<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Политика конфиденциальности — Alif Taxi</title>
    <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500;9..144,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="flex min-h-screen flex-col bg-canvas font-sans text-ink antialiased">
    <header class="border-b border-rule bg-white/70 backdrop-blur">
        <div class="mx-auto max-w-3xl px-6 py-6">
            <a href="{{ route('home') }}" class="font-display text-2xl font-semibold text-primary-deep inline-flex items-baseline gap-2">
                Alif <span class="inline-block h-2.5 w-2.5 rounded-full bg-coral"></span> Taxi
            </a>
        </div>
    </header>

    <main class="flex-1 px-6 py-10">
        <article class="prose prose-gray mx-auto max-w-3xl text-ink-soft">
            <h1 class="mb-2 font-display text-4xl font-medium tracking-tight text-ink">Политика конфиденциальности</h1>
            <p class="mb-8 text-sm text-ink-mute">Редакция от {{ date('d.m.Y') }}</p>

            <p class="mb-6 rounded-2xl border border-coral/30 bg-coral-tint p-4 text-sm text-coral-deep">
                <strong>Черновик для согласования с юристом.</strong> Поля в [квадратных скобках]
                нужно заполнить реальными данными перед публикацией.
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">1. Общие положения</h2>
            <p>
                Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок
                обработки персональных данных в мобильном приложении Alif Taxi (далее — «Сервис»)
                и связанных с ним веб-ресурсах.
            </p>
            <p>
                Оператором персональных данных является <strong>[ИП «Фамилия И.О.» / ОсОО «Название», ИНН [номер], адрес: Кыргызская Республика, г. Талас, [адрес]]</strong>
                (далее — «Оператор»).
            </p>
            <p>
                Используя Сервис, Вы подтверждаете, что ознакомились с настоящей Политикой и
                даёте согласие на обработку Ваших персональных данных на указанных в ней условиях.
                Политика разработана в соответствии с Законом Кыргызской Республики
                «Об информации персонального характера».
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">2. Какие данные мы собираем</h2>
            <p>В зависимости от роли пользователя Сервис обрабатывает следующие данные:</p>

            <h3 class="mt-4 font-display text-lg font-semibold text-ink">2.1. Клиенты (пассажиры)</h3>
            <ul class="list-disc pl-6">
                <li>номер мобильного телефона — для входа через одноразовый код (OTP);</li>
                <li>имя — для отображения водителю при принятии заказа;</li>
                <li>геолокация устройства — только в момент оформления заказа, для подачи такси;</li>
                <li>адреса подачи и назначения, история заказов, сумма;</li>
                <li>токен push-уведомлений (FCM) — для отправки уведомлений о статусе заказа.</li>
            </ul>

            <h3 class="mt-4 font-display text-lg font-semibold text-ink">2.2. Водители</h3>
            <ul class="list-disc pl-6">
                <li>номер мобильного телефона, имя;</li>
                <li>марка и государственный номер автомобиля;</li>
                <li>геолокация устройства — в фоновом режиме, пока водитель находится «на линии»,
                    для подбора ближайшего водителя к клиенту;</li>
                <li>история выполненных и отменённых заказов, причины отказов;</li>
                <li>финансовый учёт: начисленная комиссия Сервиса, история оплат;</li>
                <li>токен push-уведомлений (FCM) — для отправки предложений новых заказов.</li>
            </ul>

            <h3 class="mt-4 font-display text-lg font-semibold text-ink">2.3. Технические данные</h3>
            <ul class="list-disc pl-6">
                <li>IP-адрес, версия приложения, тип устройства, версия операционной системы;</li>
                <li>журналы ошибок и сбоев приложения — без идентифицирующего содержимого.</li>
            </ul>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">3. Зачем мы используем эти данные</h2>
            <ul class="list-disc pl-6">
                <li>оформление заказа и подбор ближайшего водителя;</li>
                <li>отображение клиенту приближения автомобиля на карте в реальном времени;</li>
                <li>отправка push-уведомлений о статусе заказа («Водитель в пути», «Водитель прибыл»);</li>
                <li>учёт выполненных поездок и расчёт комиссии Сервиса с водителей;</li>
                <li>безопасность и предотвращение злоупотреблений;</li>
                <li>исполнение требований законодательства Кыргызской Республики.</li>
            </ul>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">4. Кому мы передаём данные</h2>
            <p>Мы не продаём и не передаём Ваши данные третьим лицам, кроме случаев:</p>
            <ul class="list-disc pl-6">
                <li>
                    <strong>Между клиентом и водителем активного заказа.</strong> Водитель видит
                    имя клиента, точку подачи и точку назначения; клиент видит имя водителя,
                    марку и номер автомобиля. После завершения заказа данные собеседника
                    другому пользователю недоступны.
                </li>
                <li>
                    <strong>Технические подрядчики.</strong> Сервис использует:
                    Google Firebase Cloud Messaging — для доставки push-уведомлений (передаётся
                    только токен устройства и заголовок уведомления);
                    Pusher Channels (Pusher Ltd., США/Великобритания) — для доставки событий
                    в реальном времени (передаются только идентификаторы и статусы заказов,
                    без персональных данных).
                </li>
                <li>
                    <strong>Государственные органы Кыргызской Республики</strong> — по
                    мотивированному запросу в порядке, установленном законом.
                </li>
            </ul>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">5. Где хранятся данные</h2>
            <p>
                Все основные данные хранятся на серверах Оператора. Технические подрядчики
                (FCM, Pusher) обрабатывают только служебные данные, перечисленные выше.
            </p>
            <p>
                Срок хранения данных активного пользователя — на всё время использования
                Сервиса. После удаления учётной записи персональные данные удаляются в течение
                30 календарных дней. Финансовые и налоговые записи сохраняются в течение
                сроков, установленных законодательством КР (не более 5 лет).
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">6. Разрешения приложения</h2>
            <p>Мобильные приложения запрашивают следующие разрешения операционной системы:</p>
            <ul class="list-disc pl-6">
                <li>
                    <strong>Геолокация (Location).</strong> У клиента — только в момент
                    оформления заказа. У водителя — фоновая локация, пока водитель «на линии»;
                    в момент выхода из линии или закрытия приложения сбор останавливается.
                </li>
                <li>
                    <strong>Уведомления (Notifications).</strong> Для оповещения о новых
                    заказах и изменениях статуса.
                </li>
                <li>
                    <strong>Поверх других приложений (SYSTEM_ALERT_WINDOW, только для водителя).</strong>
                    Для показа окна нового заказа поверх других приложений (Яндекс/Bolt
                    используют этот же механизм). Окно появляется только при поступлении заказа
                    и закрывается сразу после ответа водителя.
                </li>
                <li>
                    <strong>Отключение оптимизации батареи (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    только для водителя).</strong> Чтобы система не выгружала приложение
                    в спящем режиме и водитель не пропускал заказы.
                </li>
            </ul>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">7. Ваши права</h2>
            <p>В соответствии с законодательством Кыргызской Республики Вы имеете право:</p>
            <ul class="list-disc pl-6">
                <li>получить информацию об обработке Ваших персональных данных;</li>
                <li>требовать уточнения, блокирования или удаления данных;</li>
                <li>отозвать согласие на обработку;</li>
                <li>удалить учётную запись через приложение или по запросу в поддержку.</li>
            </ul>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">8. Безопасность</h2>
            <p>
                Все соединения между приложением и сервером Оператора защищены протоколом
                HTTPS (TLS 1.2+). Пароли и одноразовые коды (OTP) хранятся в виде хеша.
                Доступ к административной панели ограничен и защищён двухфакторной
                аутентификацией для уполномоченных сотрудников Оператора.
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">9. Дети</h2>
            <p>
                Сервис не предназначен для лиц младше 18 лет. Если Вам стало известно, что
                несовершеннолетний предоставил нам персональные данные без согласия
                родителей/опекунов, пожалуйста, сообщите по контактам ниже — мы удалим эти
                данные.
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">10. Изменения Политики</h2>
            <p>
                Оператор вправе изменять настоящую Политику. Дата актуальной редакции указана
                в начале документа. При существенных изменениях пользователи будут уведомлены
                через приложение.
            </p>

            <h2 class="mt-8 font-display text-2xl font-medium tracking-tight text-ink">11. Контакты</h2>
            <p>
                По вопросам обработки персональных данных, удаления учётной записи или
                реализации Ваших прав свяжитесь с нами:
            </p>
            <ul class="list-disc pl-6">
                <li>E-mail: <strong>[support@aliftaxi.kg]</strong></li>
                <li>Телефон / WhatsApp: <strong>[+996 XXX XXX XXX]</strong></li>
                <li>Адрес: <strong>[г. Талас, Кыргызская Республика, адрес офиса]</strong></li>
            </ul>
        </article>
    </main>

    <footer class="border-t border-rule bg-white/70 backdrop-blur">
        <div class="mx-auto max-w-3xl px-6 py-4 text-center">
            <p class="text-xs text-ink-mute">
                &copy; {{ date('Y') }} Alif Taxi &middot;
                <a href="{{ route('home') }}" class="text-ink-mute hover:text-primary-deep">На главную</a>
            </p>
        </div>
    </footer>
</body>
</html>
