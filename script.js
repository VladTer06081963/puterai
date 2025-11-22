
// Настройка marked для безопасности и подсветки
marked.setOptions({
    breaks: true, // Поддержка переносов строк
    gfm: true, // GitHub Flavored Markdown
    headerIds: false, // Без ID у заголовков
    mangle: false, // Без манглирования ссылок
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
                console.warn('Highlight error:', err);
            }
        }
        try {
            return hljs.highlightAuto(code).value;
        } catch (err) {
            console.warn('Auto-highlight error:', err);
            return code;
        }
    }
});

const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');

// Rate limiting переменные
let lastSendTime = 0;
const MIN_SEND_INTERVAL = 1000; // 1 секунда между отправками

// History константы
const CHAT_HISTORY_KEY = 'puter_chat_history';
const MAX_HISTORY_LENGTH = 50; // Максимум 50 сообщений

// Проверка загрузки зависимостей
function checkDependencies() {
    const errors = [];
    if (typeof marked === 'undefined') errors.push('Marked.js (Markdown парсер)');
    if (typeof hljs === 'undefined') errors.push('Highlight.js (подсветка кода)');
    if (typeof DOMPurify === 'undefined') errors.push('DOMPurify (санитизация HTML)');
    if (typeof puter === 'undefined') errors.push('Puter.js (AI интеграция)');
    if (errors.length > 0) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot';
        errorDiv.innerHTML = `<div class="message-content">❌ Ошибка загрузки зависимостей:<br>${errors.join('<br>')}<br><br>🔄 Обновите страницу или проверьте интернет-соединение.</div>`;
        chatMessages.appendChild(errorDiv);
        console.error('Missing dependencies:', errors);
        // Отключаем чат если нет Puter.js
        if (!window.puter) {
            messageInput.disabled = true;
            messageInput.placeholder = 'Чат недоступен из-за ошибки загрузки';
        }
        return false;
    }
    return true;
}

// Загрузка зависимостей и истории
async function initializeApp() {
    if (checkDependencies()) {
        // Проверяем статус авторизации
        if (puter.auth.isSignedIn()) {
            // Загружаем сохраненную историю чата
            loadChatHistory();
            messageInput.disabled = false;
            messageInput.placeholder = 'Введите сообщение...';
        } else {
            // Показываем кнопку входа
            showSignInButton();
        }
    }
}

function showSignInButton() {
    const signInDiv = document.createElement('div');
    signInDiv.className = 'message bot';
    signInDiv.innerHTML = `
        <div class="message-content">
            👋 Привет! Для использования AI-ассистента необходимо войти в аккаунт Puter.com.
            <br><br>
            <button onclick="handleSignIn()" class="signin-button">🔑 Войти через Puter</button>
        </div>
    `;
    chatMessages.appendChild(signInDiv);

    // Блокируем ввод до входа
    messageInput.disabled = true;
    messageInput.placeholder = 'Требуется авторизация...';
}

async function handleSignIn() {
    try {
        await puter.auth.signIn();

        // Проверяем успешность входа
        if (puter.auth.isSignedIn()) {
            // Удаляем сообщение с кнопкой входа
            const signInMsg = document.querySelector('.signin-button').closest('.message');
            if (signInMsg) signInMsg.remove();

            // Разблокируем интерфейс
            messageInput.disabled = false;
            messageInput.placeholder = 'Введите сообщение...';
            loadChatHistory();

            addMessage('✅ Вы успешно вошли в систему!', 'bot');
        }
    } catch (error) {
        console.error('Sign in error:', error);
        addMessage('❌ Ошибка входа: ' + error.message, 'bot');
    }
}

// Вызываем инициализацию после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initializeApp, 100));
} else {
    setTimeout(initializeApp, 100); // Задержка для загрузки скриптов
}

// Функция: извлекает текст из ответа Puter.js
function extractText(response) {
    // Если уже строка - возвращаем как есть
    if (typeof response === 'string') {
        return response;
    }

    // Для объектов Puter.js - извлекаем из message.content
    if (typeof response === 'object' && response !== null) {
        if (response.message && typeof response.message.content === 'string') {
            return response.message.content;
        }

        // Альтернативные поля (на всякий случай)
        if (response.text && typeof response.text === 'string') return response.text;
        if (response.content && typeof response.content === 'string') return response.content;
        if (response.answer && typeof response.answer === 'string') return response.answer;

        // Пробуем toString(), если доступен и возвращает валидный текст
        try {
            const str = String(response);
            if (str && str !== '[object Object]') {
                return str;
            }
        } catch (e) {
            // Игнорируем ошибки
        }
    }

    // Если ни один вариант не сработал
    return 'Ошибка: Не удалось получить текст ответа от сервера';
}

// История чата: загрузка
function loadChatHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
        for (const message of history) {
            if (message.text && message.sender) {
                addMessage(message.text, message.sender, false); // false - не сохранять повторно
            }
        }
    } catch (error) {
        console.warn('Failed to load chat history:', error);
    }
}

// История чата: сохранение
function saveChatHistory(text, sender) {
    try {
        const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
        history.push({
            text: text,
            sender: sender,
            timestamp: Date.now()
        });
        // Очищаем старые сообщения, оставляем последние MAX_HISTORY_LENGTH
        while (history.length > MAX_HISTORY_LENGTH) {
            history.shift();
        }
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.warn('Failed to save chat history:', error);
    }
}

// Функция добавления сообщения в чат
function addMessage(text, sender, saveToHistory = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Обработка Markdown для сообщений бота
    if (sender === 'bot') {
        try {
            const textToParse = extractText(text);
            // Парсим Markdown в HTML и санитизируем для безопасности
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(textToParse));
        } catch (error) {
            console.error('Markdown parsing error:', error);
            // Если парсинг Markdown не удался, показываем как есть
            contentDiv.textContent = extractText(text);
        }
    } else {
        // Для пользователя — простой текст
        contentDiv.textContent = text;
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Сохраняем в историю если нужно
    if (saveToHistory) {
        saveChatHistory(text, sender);
    }

    // Прокрутка вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Функция отправки сообщения
async function sendMessage() {
    const currentTime = Date.now();

    // Rate limiting: проверка интервала между отправками
    if (currentTime - lastSendTime < MIN_SEND_INTERVAL) {
        addMessage('⏱ Подождите 1 секундy перед отправкой следующего сообщения', 'bot');
        return;
    }

    const message = messageInput.value.trim();
    if (!message) return;

    lastSendTime = currentTime;

    // Добавляем сообщение пользователя
    addMessage(message, 'user');
    messageInput.value = '';

    // Добавляем индикатор "печатает"
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Отправляем запрос к AI через s.puter с таймаутом 30 секунд
        const response = await Promise.race([
            puter.ai.chat(message, { model: "moonshotai/kimi-k2" }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Превышено время ожидания ответа (30с)')), 30000))
        ]);

        // Удаляем индикатор
        typingDiv.remove();

        // Добавляем ответ бота (с Markdown)
        addMessage(response, 'bot');

    } catch (error) {
        // Удаляем индикатор
        typingDiv.remove();

        console.error('AI request error:', error);

        // Показываем ошибку в чате
        // Показываем ошибку в чате
        if (error.message && error.message.includes('401')) {
            addMessage('❌ Ошибка авторизации. Пожалуйста, войдите в систему.', 'bot');
            showSignInButton();
        } else {
            addMessage('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'), 'bot');
        }
    }
}

// Обработчики событий
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Предотвращаем перевод строки
        sendMessage();
    }
});

// Фокус на поле ввода при загрузке
messageInput.focus();

// Theme switching functionality
const themeToggle = document.getElementById('themeToggle');
const clearButton = document.getElementById('clearButton');
const themeIcon = document.getElementById('themeIconDisplay');

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '');
updateThemeIcon(savedTheme);

function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme === 'light' ? 'light' : '');
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function clearChat() {
    if (confirm('Вы уверены, что хотите очистить историю чата?')) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        chatMessages.innerHTML = '';

        // Restore welcome message
        const welcomeMsg = `
            <div class="message bot">
                <div class="message-content">
                    Привет! Я AI-ассистент на базе Puter.js.
                    Поддерживаю Markdown разметку:
                    - Списки
                    - Код
                    - <a href="#">Ссылки</a>
                    - Таблицы и многое другое!
                </div>
            </div>
        `;
        chatMessages.innerHTML = welcomeMsg;
        addMessage('🧹 История чата очищена', 'bot', false);
    }
}

themeToggle.addEventListener('click', toggleTheme);
clearButton.addEventListener('click', clearChat);
