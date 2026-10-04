export class AclDualListbox {
    /**
     * @param {string} containerSelector - Селектор пустого контейнера в DOM
     * @param {Object} options - Настройки виджета
     */
    constructor(containerSelector, options) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) throw new Error(`Контейнер ${containerSelector} не найден.`);

        // Дефолтные настройки
        const defaults = {
            showSearch: true,
            entityParamName: 'entity_id',
            leftLabel: '',    // По умолчанию пусто (не выводим)
            rightLabel: '',   // По умолчанию пусто (не выводим)
            urls: {available: '', assigned: '', save: ''},
            mapping: {id: 'id', name: 'name', description: 'description', group: 'group'},
            onSelectEntityClick: (updateWidget) => {
            }
        };

        this.options = {...defaults, ...options};
        this.elements = {};
        this.assignedIds = new Set(); // Хранилище ID разрешенных экшенов

        this.init();
    }

    /**
     * Генерация монолитной Bootstrap 5 карточки
     */
    init() {
        const showSearchClass = this.options.showSearch ? '' : 'd-none';

        // Создаем изолированный элемент самой карточки
        this.widgetCard = document.createElement('div');
        this.widgetCard.className = 'card shadow-sm position-relative';

        // Внутри метода init() перед генерацией этой части сформируем HTML подписей
        const leftTitleHtml = this.options.leftLabel
            ? `<div class="d-flex flex-column mb-2">
        <div class="fw-bold text-secondary small text-uppercase tracking-wider">${this.options.leftLabel}</div>
        <div class="d-flex justify-content-between align-items-center text-secondary small fw-medium" style="font-size: 0.8rem;">
            <div>
                Доступно: &nbsp;<span id="acl-count-available" class="text-dark fw-bold">0</span> &bull; 
                Выбрано: &nbsp;<span id="acl-count-selected" class="text-dark fw-bold">0</span>
            </div>
            <button type="button" class="btn btn-link acl-btn-collapse-all p-0 text-decoration-none text-secondary small fw-medium" style="font-size: 0.8rem;">Свернуть все</button>
        </div>
       </div>`
            : '';

        const rightTitleHtml = this.options.rightLabel
            ? `<div class="d-flex flex-column mb-2">
        <div class="fw-bold text-secondary small text-uppercase tracking-wider">${this.options.rightLabel}</div>
        <div class="d-flex align-items-center text-secondary small fw-medium" style="font-size: 0.8rem;">
            Загружено: &nbsp;<span id="acl-count-loaded" class="text-dark fw-bold">0</span> &nbsp;&bull;
            Добавлено: &nbsp;<span id="acl-count-added" class="text-dark fw-bold">0</span>
        </div>
       </div>`
            : '';

        this.widgetCard.innerHTML = `
            <div class="card shadow-sm position-relative">
                <!-- Блокирующий оверлей (активен, пока не выбрана сущность) -->
                <div class="acl-overlay position-absolute top-0 start-0 w-100 h-100 bg-white opacity-75 d-flex align-items-center justify-content-center" style="z-index: 10; border-radius: inherit;">
                    <span class="text-secondary fw-bold fs-5">Для начала работы выберите сущность</span>
                </div>

                <!-- Шапка карточки -->
                <div class="card-header bg-white py-3 d-flex align-items-center justify-content-between border-bottom" style="z-index: 11;">
                    <div class="d-flex align-items-center gap-2">
                        <input type="hidden" id="acl-hidden-id" value="">
                        <span id="acl-entity-label">Сущность не выбрана</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" id="acl-btn-select" class="btn btn-outline-primary btn-sm px-3">Выбрать...</button>
                        <button type="button" id="acl-btn-save" class="btn btn-success btn-sm px-3" disabled>Сохранить изменения</button>
                    </div>
                </div>

                <!-- Строка поиска (опционально) -->
                <div class="card-body border-bottom py-2 bg-light-subtle ${showSearchClass}">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-white border-end-0 text-secondary">🔍</span>
                        <input type="text" id="acl-search" class="form-control border-start-0" placeholder="Быстрый поиск экшенов по названию или описанию...">
                    </div>
                </div>

                <!-- Основной контент (Монолитная структура на процентах без col-md) -->
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-stretch">
                        
                        <!-- Левая панель: Доступные (Строго 44% ширины) -->
                        <div class="d-flex flex-column" style="width: 46%;">
                            ${leftTitleHtml}
                            <div id="acl-panel-left" class="border rounded p-2 overflow-y-auto position-relative bg-white" style="height: 400px;">
                                <div class="acl-spinner d-none position-absolute top-50 start-50 translate-middle text-center">
                                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                                </div>
                                <div class="acl-content-area"></div>
                            </div>
                        </div>
            
                        <!-- Центральный блок: Управление (Строго 10% ширины, кнопки компактные) -->
                        <div class="d-flex flex-column align-items-center justify-content-center gap-2 px-1" style="width: 6%;">
                            <button type="button" id="acl-move-right" class="btn btn-outline-secondary btn-sm w-100 py-2 d-flex justify-content-center" title="Перенести выделенные" disabled>
                                <i class="bi bi-chevron-right"></i>
                            </button>
                            <button type="button" id="acl-move-all-right" class="btn btn-outline-secondary btn-sm w-100 py-2 d-flex justify-content-center" title="Перенести все доступные" disabled>
                                <i class="bi bi-chevron-double-right"></i>
                            </button>
                            <button type="button" id="acl-move-left" class="btn btn-outline-secondary btn-sm w-100 py-2 d-flex justify-content-center" title="Убрать выделенные" disabled>
                                <i class="bi bi-chevron-left"></i>
                            </button>
                            <button type="button" id="acl-move-all-left" class="btn btn-outline-secondary btn-sm w-100 py-2 d-flex justify-content-center" title="Убрать все разрешенные" disabled>
                                <i class="bi bi-chevron-double-left"></i>
                            </button>
                        </div>
            
                        <!-- Правая панель: Разрешенные (Строго 44% ширины) -->
                        <div class="d-flex flex-column" style="width: 46%;">
                            ${rightTitleHtml}
                            <div id="acl-panel-right" class="border rounded p-2 overflow-y-auto position-relative bg-white" style="height: 400px;">
                                <div class="acl-spinner d-none position-absolute top-50 start-50 translate-middle text-center">
                                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                                </div>
                                <div class="acl-content-area list-group list-group-flush"></div>
                            </div>
                        </div>
            
                    </div>
                </div>
            </div>
        `;

        // Очищаем контейнер и вставляем в него нашу карточку
        this.container.innerHTML = '';
        this.container.appendChild(this.widgetCard);

        this.cacheElements();
        this.bindEvents();
    }

    /**
     * Кэширование ссылок на DOM-элементы
     */
    cacheElements() {
        const c = this.widgetCard;
        this.elements = {
            overlay: c.querySelector('.acl-overlay'),
            hiddenInput: c.querySelector('#acl-hidden-id'),
            entityLabel: c.querySelector('#acl-entity-label'),
            btnSelect: c.querySelector('#acl-btn-select'),
            btnSave: c.querySelector('#acl-btn-save'),
            searchInput: c.querySelector('#acl-search'),
            panelLeft: c.querySelector('#acl-panel-left'),
            panelRight: c.querySelector('#acl-panel-right'),
            spinnerLeft: c.querySelector('#acl-panel-left .acl-spinner'),
            spinnerRight: c.querySelector('#acl-panel-right .acl-spinner'),
            contentLeft: c.querySelector('#acl-panel-left .acl-content-area'),
            contentRight: c.querySelector('#acl-panel-right .acl-content-area'),
            btnRight: c.querySelector('#acl-move-right'),
            btnAllRight: c.querySelector('#acl-move-all-right'),
            btnLeft: c.querySelector('#acl-move-left'),
            btnAllLeft: c.querySelector('#acl-move-all-left'),
            // Новые счетчики
            countAvailable: c.querySelector('#acl-count-available'),
            countSelected: c.querySelector('#acl-count-selected'),
            countLoaded: c.querySelector('#acl-count-loaded'),
            countAdded: c.querySelector('#acl-count-added'),

            // Новая кнопка управления
            btnCollapseAll: c.querySelector('.acl-btn-collapse-all')
        };
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Клик по кнопке Выбрать... выводит наружу управление
        this.elements.btnSelect.addEventListener('click', () => {
            this.options.onSelectEntityClick((data) => this.updateEntity(data));
        });

        // Слушатель строки поиска
        this.elements.searchInput.addEventListener('input', (e) => {
            this.filterLeftPanel(e.target.value.trim());
        });

        if (this.elements.btnCollapseAll) {
            this.elements.btnCollapseAll.addEventListener('click', () => this.collapseAllGroups());
        }

        // Делегирование кликов для динамической подсветки пунктов без дерганья
        this.widgetCard.addEventListener('click', (e) => {
            const item = e.target.closest('.acl-item');
            if (!item) return;

            e.preventDefault();

            // 1. Переключаем стандартный легкий фон Bootstrap 5
            item.classList.toggle('bg-light');
            this.updateLeftCounters();

            // 2. Используем трюк из твоего VanillaDataTable: рисуем рамку строго ВНУТРЬ плашки
            if (item.style.outline) {
                item.style.outline = '';
                item.style.outlineOffset = '';
            } else {
                // Задаем цвет стандартной бутстраповской рамки (#6c757d)
                item.style.outline = '2px solid #6c757d';
                item.style.outlineOffset = '-2px'; // Сдвигаем внутрь, чтобы не дергался текст
            }

            this.updateControlButtonsState();
        });

        // Логика кнопок переноса и сохранения будет привязана в Части 2
        // Двойной клик (dblclick) = мгновенный поштучный перенос
        this.widgetCard.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.acl-item');
            if (!item) return;

            // Проверяем, в какой панели лежит элемент, и передаем строку направления
            const direction = item.closest('#acl-panel-left') ? 'right' : 'left';
            this.moveItems([item], direction);
        });

        // Кнопка [ > ] (Перенос выделенных вправо)
        this.elements.btnRight.addEventListener('click', () => {
            const selected = Array.from(this.elements.contentLeft.querySelectorAll('.acl-item.bg-light'));
            this.moveItems(selected, 'right');
        });

        // Кнопка [ < ] (Возврат выделенных влево)
        this.elements.btnLeft.addEventListener('click', () => {
            const selected = Array.from(this.elements.contentRight.querySelectorAll('.acl-item.bg-light'));
            this.moveItems(selected, 'left');
        });

        // Кнопка [ >> ] (Перенести все видимые вправо)
        this.elements.btnAllRight.addEventListener('click', () => {
            const visible = Array.from(this.elements.contentLeft.querySelectorAll('.acl-item:not(.d-none)'));
            this.moveItems(visible, 'right');
        });

        // Кнопка [ << ] (Очистить все разрешенные)
        this.elements.btnAllLeft.addEventListener('click', () => {
            const all = Array.from(this.elements.contentRight.querySelectorAll('.acl-item'));
            this.moveItems(all, 'left');
        });

        // Кнопка Сохранить изменения
        this.elements.btnSave.addEventListener('click', () => this.saveData());
    }

    /**
     * Публичный коллбэк для вашей стрелочной функции (принимает объект)
     * @param {Object} entityData - { id: 3, label: 'Пользователь: Иванов И.И.' }
     */
    updateEntity(entityData) {
        console.log(entityData);
        if (!entityData || !entityData.id) return;

        // Заполняем данные сущности
        this.elements.hiddenInput.value = entityData.id;
        this.elements.entityLabel.textContent = entityData.label || `ID: ${entityData.id}`;

        // Меняем оформление лейбла с дефолтного серого на акцентный Bootstrap
        this.elements.entityLabel.classList.remove('bg-secondary');
        this.elements.entityLabel.classList.add('text-primary');

        // Убираем блокирующий оверлей и активируем сохранение
        this.elements.overlay.classList.add('d-none');
        this.elements.btnSave.removeAttribute('disabled');

        // Запускаем загрузку данных (метод будет в Части 2)
        this.loadData(entityData.id);
    }

    /**
     * Вспомогательный метод обновления доступности кнопок управления
     */
    updateControlButtonsState() {
        // Проверяем, есть ли выделенные (подсвеченные) элементы в панелях
        const hasLeftSelected = !!this.elements.contentLeft.querySelector('.acl-item.bg-light');
        const hasRightSelected = !!this.elements.contentRight.querySelector('.acl-item.bg-light');

        // Проверяем, есть ли вообще элементы, пригодные для массового переноса (все или ничего)
        const hasLeftItems = !!this.elements.contentLeft.querySelector('.acl-item:not(.d-none)');
        const hasRightItems = !!this.elements.contentRight.querySelector('.acl-item');

        // Управляем кнопками одиночного переноса [ > ] и [ < ]
        if (hasLeftSelected) this.elements.btnRight.removeAttribute('disabled');
        else this.elements.btnRight.setAttribute('disabled', 'true');

        if (hasRightSelected) this.elements.btnLeft.removeAttribute('disabled');
        else this.elements.btnLeft.setAttribute('disabled', 'true');

        // Управляем кнопками массового переноса [ >> ] и [ << ]
        if (hasLeftItems) this.elements.btnAllRight.removeAttribute('disabled');
        else this.elements.btnAllRight.setAttribute('disabled', 'true');

        if (hasRightItems) this.elements.btnAllLeft.removeAttribute('disabled');
        else this.elements.btnAllLeft.setAttribute('disabled', 'true');
    }

    /**
     * Загрузка данных из двух независимых эндпоинтов с жесткой проверкой HTTP-статусов
     */
    async loadData(entityId) {
        // Включаем спиннеры загрузки и очищаем панели
        this.elements.spinnerLeft.classList.remove('d-none');
        this.elements.spinnerRight.classList.remove('d-none');
        this.elements.contentLeft.innerHTML = '';
        this.elements.contentRight.innerHTML = '';
        this.assignedIds.clear();

        // Переменные для хранения сообщений об ошибках с бэкенда
        let errorMessageLeft = '';
        let errorMessageRight = '';

        try {
            const urlAvail = `${this.options.urls.available}&${this.options.entityParamName}=${entityId}`;
            const urlAssigned = `${this.options.urls.assigned}&${this.options.entityParamName}=${entityId}`;

            // --- ШАГ 1: ЗАПРОС К ЛЕВОЙ ПАНЕЛИ ---
            const resAvail = await fetch(urlAvail);
            if (!resAvail.ok) {
                let msg = `Ошибка сервера (Код: ${resAvail.status})`;
                try { const json = await resAvail.json(); msg = json.message || msg; } catch(e) {}

                this.elements.contentLeft.innerHTML = `<div class="text-danger small p-2">⚠️ Ошибка: ${msg}</div>`;
                this.elements.contentRight.innerHTML = `<div class="text-danger small p-2">⚠️ Ошибка: ${msg}</div>`;
                return;
            }
            const dataAvail = await resAvail.json();

            // --- ШАГ 2: ЗАПРОС К ПРАВОЙ ПАНЕЛИ ---
            const resAssigned = await fetch(urlAssigned);
            if (!resAssigned.ok) {
                let msg = `Ошибка сервера (Код: ${resAssigned.status})`;
                try { const json = await resAssigned.json(); msg = json.message || msg; } catch(e) {}

                // Ошибка в правой панели — блокируем ОБЕ панели, не давая "поглазеть"
                this.elements.contentLeft.innerHTML = `<div class="text-danger small p-2">⚠️ Работа невозможна: сбой загрузки данных</div>`;
                this.elements.contentRight.innerHTML = `<div class="text-danger small p-2">⚠️ Ошибка: ${msg}</div>`;
                return;
            }
            const dataAssigned = await resAssigned.json();

            // --- ШАГ 3: УСПЕШНЫЙ РЕНДЕРИНГ (только когда всё железно загрузилось) ---
            this.renderAssigned(dataAssigned.items || dataAssigned);
            this.renderAvailable(dataAvail.items || dataAvail);

        }
        catch (err) {
            console.error('Ошибка в конвейере загрузки ACL:', err);

            // Формируем красивый и понятный вывод ошибок для пользователя
            const leftText = errorMessageLeft || 'Произошла непредвиденная ошибка при загрузке данных.';
            const rightText = errorMessageRight || 'Произошла непредвиденная ошибка при загрузке данных.';

            this.elements.contentLeft.innerHTML = `<div class="text-danger small p-2">⚠️ Ошибка: ${leftText}</div>`;
            this.elements.contentRight.innerHTML = `<div class="text-danger small p-2">⚠️ Ошибка: ${rightText}</div>`;
        } finally {
            // В любом сценарии выключаем спиннеры и обновляем доступность кнопок
            this.elements.spinnerLeft.classList.add('d-none');
            this.elements.spinnerRight.classList.add('d-none');
            this.updateControlButtonsState();
        }
    }

    /**
     * Рендеринг правой панели (Разрешенные - плоский список)
     */
    renderAssigned(items) {
        const m = this.options.mapping;
        let html = '';

        items.forEach(item => {
            const id = item[m.id];
            this.assignedIds.add(String(id)); // Запоминаем разрешенный ID

            // Добавили тег с классом acl-badge-new. По умолчанию он скрыт (d-none)
            html += `
                <div class="acl-item list-group-item list-group-item-action border rounded-1 mb-1 p-2 cursor-pointer small" 
                     data-id="${id}" data-name="${item[m.name]}" data-group="${item[m.group] || ''}">
                    <strong>${item[m.name]}</strong><span class="acl-badge-new text-success fw-bold d-none ms-1" style="font-size: 0.75rem;">(новое)</span><br>
                    <span class="text-muted">${item[m.description]}</span>
                </div>`;
        });

        this.elements.contentRight.innerHTML = html || '<div class="acl-placeholder text-muted small p-2 text-center">Нет назначенных прав</div>';

        // ТОЧКА ИНТЕГРАЦИИ: Фиксируем базовое количество загруженных прав
        this.updateRightCounters(items.length);
    }

    /**
     * Рендеринг левой панели (Доступные - компактное дерево на <details>)
     */
    renderAvailable(items) {
        const m = this.options.mapping;

        // Группируем элементы по group_name в памяти фронтенда
        const groups = {};
        items.forEach(item => {
            const groupName = item[m.group] || 'Без группы';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(item);
        });

        let html = '';
        for (const [groupName, groupItems] of Object.entries(groups)) {
            let itemsHtml = '';

            groupItems.forEach(item => {
                const id = String(item[m.id]);
                // Если элемент уже есть в правой панели — сразу скрываем его через d-none
                const isHidden = this.assignedIds.has(id) ? 'd-none' : '';

                itemsHtml += `
                    <div class="acl-item border rounded-1 mb-1 p-2 cursor-pointer small ${isHidden}"
                         data-id="${id}" data-name="${item[m.name]}" data-group="${groupName}">
                        <strong>${item[m.name]}</strong><span class="acl-badge-new text-success fw-bold d-none ms-1" style="font-size: 0.75rem;">(новое)</span><br>
                        <span class="text-muted">${item[m.description]}</span>
                    </div>`;
            });

            html += `
                <details class="acl-group mb-2">
                    <summary class="fw-bold text-secondary cursor-pointer py-1 bg-light px-2 border rounded-1 small mb-1">
                        📂 ${groupName}
                    </summary>
                    <div class="ps-2 acl-group-items">${itemsHtml}</div>
                </details>`;
        }

        this.elements.contentLeft.innerHTML = html || '<div class="text-muted small p-2 text-center">Доступные экшены не найдены</div>';
        this.checkEmptyGroups(); // Прячем пустые папки
        this.updateLeftCounters(); // ТОЧКА ИНТЕГРАЦИИ
    }

    /**
     * Универсальный метод перемещения элементов между панелями (Вариант со скрытием d-none)
     * @param {HTMLElement[]} items - Массив элементов для переноса
     * @param {string} direction - Направление ('right' или 'left')
     */
    moveItems(items, direction)
    {
        if (!items.length) return;

        items.forEach(item => {
            const id = String(item.dataset.id);

            // Снимаем нашу кастомную деликатную подсветку
            // item.classList.remove('bg-light', 'border-start', 'border-3', 'border-secondary');
            // Гасим подсветку при переносе (убираем классы и инлайн-стили)
            item.classList.remove('bg-light');
            item.style.outline = '';
            item.style.outlineOffset = '';

            if (direction === 'right') {
                // Перенос ВПРАВО (Разрешить право)
                if (this.assignedIds.has(id)) return; // Защита от дублей
                this.assignedIds.add(id);

                // Скрываем оригинал в левом дереве
                const leftOriginal = this.elements.contentLeft.querySelector(`.acl-item[data-id="${id}"]`);
                if (leftOriginal) leftOriginal.classList.add('d-none');

                // Создаем копию для правой панели
                const clone = item.cloneNode(true);

                // КРИТИЧЕСКИ ВАЖНО: Полностью очищаем классы клона и задаем их заново,
                // чтобы исключить перенос d-none, border-secondary или bg-light от оригинального узла
                clone.className = 'acl-item list-group-item list-group-item-action border rounded-1 mb-1 p-2 cursor-pointer small';

                // ТОЧКА ИНТЕГРАЦИИ: Маркируем элемент как новый в текущей сессии
                clone.classList.add('acl-item-new');
                const badge = clone.querySelector('.acl-badge-new');
                if (badge) badge.classList.remove('d-none'); // Проявляем надпись "(новое)"

                this.elements.contentRight.appendChild(clone);
            } else {
                // Перенос ВЛЕВО (Отозвать право)
                this.assignedIds.delete(id);

                // Удаляем плоскую копию из правого списка
                const rightCopy = this.elements.contentRight.querySelector(`.acl-item[data-id="${id}"]`);
                if (rightCopy) rightCopy.remove();

                // Проявляем оригинал в левом дереве, если он не отсечен поиском
                const leftOriginal = this.elements.contentLeft.querySelector(`.acl-item[data-id="${id}"]`);
                if (leftOriginal) {
                    const searchWord = this.elements.searchInput.value.toLowerCase();
                    const text = (leftOriginal.dataset.name + ' ' + leftOriginal.textContent).toLowerCase();

                    if (searchWord === '' || text.includes(searchWord)) {
                        leftOriginal.classList.remove('d-none');
                    }
                }
            }
        });

        // Если в правой панели пусто — возвращаем заглушку текста
        if (this.assignedIds.size === 0) {
            this.elements.contentRight.innerHTML = '<div class="acl-placeholder text-muted small p-2 text-center">Нет назначенных прав</div>';
        } else {
            const placeholder = this.elements.contentRight.querySelector('.acl-placeholder');
            console.log(placeholder);
            if (placeholder) placeholder.remove();
        }

        this.checkEmptyGroups();
        this.updateControlButtonsState();
        this.updateLeftCounters();   // ТОЧКА ИНТЕГРАЦИИ
        this.updateRightCounters();  // ТОЧКА ИНТЕГРАЦИИ
    }

    /**
     * Быстрый текстовый поиск по левой панели (Доступные экшены)
     */
    filterLeftPanel (query)
    {
        const searchWord = query.toLowerCase();
        const groups = this.elements.contentLeft.querySelectorAll('.acl-group');

        groups.forEach(group => {
            const items = group.querySelectorAll('.acl-item');
            let hasVisibleItems = false;

            items.forEach(item => {
                const id = String(item.dataset.id);

                // Если элемент уже выбран — он всегда d-none
                if (this.assignedIds.has(id)) {
                    item.classList.add('d-none');
                    return;
                }

                // Ищем совпадения в системном имени и текстовом описании
                const textContent = (item.dataset.name + ' ' + item.textContent).toLowerCase();
                if (searchWord === '' || textContent.includes(searchWord)) {
                    item.classList.remove('d-none');
                    hasVisibleItems = true;
                } else {
                    item.classList.add('d-none');
                }
            });

            // Управляем видимостью и раскрытием всей папки details
            if (hasVisibleItems) {
                group.classList.remove('d-none');
                if (searchWord !== '') group.setAttribute('open', 'true'); // Авто-раскрытие папки при поиске
            } else {
                group.classList.add('d-none');
            }
        });
        this.updateLeftCounters();
    }

    /**
     * Вспомогательный метод: скрывает пустые папки <details>, если в них всё перенесено вправо
     */
    checkEmptyGroups()
    {
        const groups = this.elements.contentLeft.querySelectorAll('.acl-group');
        groups.forEach(group => {
            const hasVisibleItems = !!group.querySelector('.acl-item:not(.d-none)');
            if (hasVisibleItems) {
                group.classList.remove('d-none');
            } else {
                group.classList.add('d-none');
            }
        });
    }

    /**
     * Метод обновления динамических счетчиков и маркеров левой панели
     */
    updateLeftCounters() {
        if (!this.elements.contentLeft) return;

        // 1. Считаем доступные (те, что видны и не скрыты через d-none)
        const availableCount = this.elements.contentLeft.querySelectorAll('.acl-item:not(.d-none)').length;
        if (this.elements.countAvailable) {
            this.elements.countAvailable.textContent = availableCount;
        }

        // 2. Считаем выделенные (bg-light)
        const selectedCount = this.elements.contentLeft.querySelectorAll('.acl-item.bg-light').length;
        if (this.elements.countSelected) {
            this.elements.countSelected.textContent = selectedCount;
        }

        // 3. Управление маркерами на папках <summary>
        const groups = this.elements.contentLeft.querySelectorAll('.acl-group');
        groups.forEach(group => {
            const summary = group.querySelector('summary');
            if (!summary) return;

            // Ищем, есть ли в текущей группе хоть один выделенный элемент
            const hasSelectedInGroup = !!group.querySelector('.acl-group-items .acl-item.bg-light');

            // Ищем или создаем элемент маркера внутри summary
            let marker = summary.querySelector('.acl-group-marker');

            if (hasSelectedInGroup) {
                if (!marker) {
                    // Создаем маркер в виде аккуратной точки цвета Bootstrap Primary перед текстом
                    marker = document.createElement('span');
                    marker.className = 'acl-group-marker badge bg-primary rounded-pill p-1 me-2 align-middle d-inline-block';
                    marker.style.width = '7px';
                    marker.style.height = '7px';

                    // Вставляем маркер в самое начало summary (между дефолтной стрелкой папки и текстом)
                    summary.prepend(marker);
                }
            } else {
                if (marker) marker.remove();
            }
        });
    }

    /**
     * Метод обновления счетчиков правой панели
     * @param {number|null} initialCount - передается только ОДИН раз при загрузке базового списка роли
     */
    updateRightCounters(initialCount = null) {
        if (!this.elements.contentRight) return;

        // 1. Загружено изначально (фиксируем статичное число при первой загрузке данных роли)
        if (initialCount !== null && this.elements.countLoaded) {
            this.elements.countLoaded.textContent = initialCount;
        }

        // 2. Добавлено в сессии (считаем элементы с нашим новым маркером)
        const addedCount = this.elements.contentRight.querySelectorAll('.acl-item-new').length;
        if (this.elements.countAdded) {
            this.elements.countAdded.textContent = addedCount;
        }
    }

    /**
     * Логика кнопки «Свернуть все» для левой панели
     */
    collapseAllGroups() {
        if (!this.elements.contentLeft) return;
        const groups = this.elements.contentLeft.querySelectorAll('.acl-group');
        groups.forEach(group => {
            group.removeAttribute('open');
        });
    }

    /**
     * Отложенное сохранение изменений одной кнопкой
     */
    async saveData()
    {
        const entityId = this.elements.hiddenInput.value;
        if (!entityId) return;

        // Собираем массив только из актуальных ID разрешенных прав
        const actionIds = Array.from(this.assignedIds);

        // Визуально блокируем кнопку на время сохранения
        this.elements.btnSave.setAttribute('disabled', 'true');
        this.elements.btnSave.textContent = 'Сохранение...';

        try {
            // Формируем payload для отправки
            const formData = new FormData();
            formData.append(this.options.entityParamName, entityId);

            // Передаем массив ID (бэкенд примет его как стандартный массив параметров POST)
            actionIds.forEach(id => formData.append('action_ids[]', id));

            const response = await fetch(this.options.urls.save, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success || response.ok) {
                // Красивый мигающий эффект успеха на кнопке
                this.elements.btnSave.className = 'btn btn-success btn-sm px-3';
                this.elements.btnSave.textContent = 'Сохранено! ✓';
            } else {
                throw new Error(result.error || 'Ошибка бэкенда');
            }
        } catch (err) {
            console.error('Ошибка сохранения прав:', err);
            alert('Не удалось сохранить изменения. Попробуйте еще раз.');
            this.elements.btnSave.className = 'btn btn-danger btn-sm px-3';
            this.elements.btnSave.textContent = 'Ошибка!';
        } finally {
            // Возвращаем кнопку в исходное рабочее состояние через 1.5 секунды
            setTimeout(() => {
                this.elements.btnSave.className = 'btn btn-success btn-sm px-3';
                this.elements.btnSave.textContent = 'Сохранить изменения';
                this.elements.btnSave.removeAttribute('disabled');
            }, 1500);
        }
    }

    /**
     * Деструктор класса: освобождает память, удаляет глобальные слушатели
     * и полностью уничтожает виджет.
     */
    destroy() {
        console.log('Вызван деструктор ACL-виджета. Очистка памяти...');

        // 1. Снимаем все обработчики событий, которые мы вешали на глобальные объекты (если они были)
        // На текущий момент мы вешали всё на this.widgetCard и this.container,
        // которые удалятся вместе с DOM, но если в будущем добавятся window/document — их удаляют здесь:
        // window.removeEventListener('resize', this._someMethod);

        // 2. Очищаем коллекции, освобождая ссылки на строки/ID
        if (this.assignedIds) {
            this.assignedIds.clear();
        }

        // 3. Обнуляем ссылки на крупные DOM-узлы, чтобы разорвать циклические зависимости
        for (const key in this.elements) {
            if (this.elements.hasOwnProperty(key)) {
                this.elements[key] = null;
            }
        }
        this.elements = null;

        // 4. Удаляем ссылки на внешние функции (коллбэки)
        if (this.options) {
            this.options.onSelectEntityClick = null;
            this.options = null;
        }

        // 5. Физически удаляем саму карточку из DOM-дерева (если её ещё не удалили через innerHTML = '')
        if (this.widgetCard && this.widgetCard.parentNode) {
            this.widgetCard.remove();
        }
        this.widgetCard = null;
        this.container = null;

        console.log('ACL-виджет успешно вычищен из памяти.');
    }

}