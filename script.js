
        // Настройка marked для безопасности и подсветки
        marked.setOptions({
            breaks: true, // Поддержка переносов строк
            gfm: true, // GitHub Flavored Markdown
            headerIds: false, // Без ID у заголовков
            mangle: false, // Без манглирования ссылок
            highlight: function(code, lang) {
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
        
        // КРИТИЧНО ВАЖНАЯ ФУНКЦИЯ: извлекает текст из ответа s.puter
        function extractText(response) {
            // Если это уже строка — возвращаем как есть
            if (typeof response === 'string') {
                return response;
            }
            
            // Если это объект со структурой message.content (как в s.puter)
            if (response && typeof response === 'object') {
                // Проверяем стандартную структуру s.puter: response.message.content
                if (response.message && response.message.content && typeof response.message.content === 'string') {
                    return response.message.content;
                }
                
                // Альтернативные возможные поля (на всякий случай)
                if (response.text && typeof response.text === 'string') return response.text;
                if (response.content && typeof response.content === 'string') return response.content;
                if (response.answer && typeof response.answer === 'string') return response.answer;
                
                // Если объект имеет метод toString() (как в структуре выше)
                try {
                    const stringRepresentation = String(response);
                    if (stringRepresentation !== '[object Object]') {
                        return stringRepresentation;
                    }
                } catch (e) {
                    // Игнорируем ошибки toString()
                }
                
                // Если ничего не помогло, возвращаем JSON (для отладки)
                try {
                    return JSON.stringify(response, null, 2);
                } catch (e) {
                    return String(response);
                }
            }
            
            // Для любых других типов
            return String(response);
        }
        
        // Функция добавления сообщения в чат
        function addMessage(text, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            // Обработка Markdown для сообщений бота
            if (sender === 'bot') {
                try {
                    const textToParse = extractText(text);
                    // Парсим Markdown в HTML
                    contentDiv.innerHTML = marked.parse(textToParse);
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
            
            // Прокрутка вниз
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Функция отправки сообщения
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            
            // Добавляем сообщение пользователя
            addMessage(message, 'user');
            messageInput.value = '';
            
            // Добавляем индикатор "печатает"
            const typingDiv = document.createElement('div');
            typingDiv.className = 'typing-indicator';
            typingDiv.innerHTML = '🤖 печатает<span class="dots">...</span>';
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            try {
                // Отправляем запрос к AI через s.puter
                const response = await puter.ai.chat(message, { 
                    model: "moonshotai/kimi-k2" 
                });
                
                // Удаляем индикатор
                typingDiv.remove();
                
                // Добавляем ответ бота (с Markdown)
                addMessage(response, 'bot');
                
            } catch (error) {
                // Удаляем индикатор
                typingDiv.remove();
                
                console.error('AI request error:', error);
                
                // Показываем ошибку в чате
                addMessage('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'), 'bot');
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
        const themeIcon = document.querySelector('.theme-icon');

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

        themeToggle.addEventListener('click', toggleTheme);
