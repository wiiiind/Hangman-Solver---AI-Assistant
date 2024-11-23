window.currentWord = '';
window.guessedLetters = new Set();
window.remainingAttempts = 7;
window.guessHistory = [];
window.selectedPositions = new Set();
window.actualGuessCount = 0;

window.WORD_FREQUENCIES = {};
window.LETTER_FREQUENCIES = {
    'e': 12.7, 't': 9.1, 'a': 8.2, 'o': 7.5, 'i': 7.0, 'n': 6.7, 's': 6.3,
    'h': 6.1, 'r': 6.0, 'd': 4.3, 'l': 4.0, 'c': 2.8, 'u': 2.8, 'm': 2.4,
    'w': 2.4, 'f': 2.2, 'g': 2.0, 'y': 2.0, 'p': 1.9, 'b': 1.5, 'v': 1.0,
    'k': 0.8, 'j': 0.15, 'x': 0.15, 'q': 0.10, 'z': 0.07
};

Set.prototype.difference = function(setB) {
    return new Set([...this].filter(x => !setB.has(x)));
};

window.findPossibleWords = function(pattern) {
    const regexPattern = pattern.split('').map(char => {
        return char === '_' ? '[a-z]' : char;
    }).join('');
    const regex = new RegExp(`^${regexPattern}$`);

    return Object.keys(window.WORD_FREQUENCIES).filter(word => {
        if (word.length !== pattern.length) return false;
        if (!regex.test(word)) return false;
        
        for (let letter of window.guessedLetters) {
            const patternPositions = pattern.split('').map((char, index) => 
                char === letter ? index : -1
            ).filter(pos => pos !== -1);
            
            const wordPositions = word.split('').map((char, index) => 
                char === letter ? index : -1
            ).filter(pos => pos !== -1);
            
            if (patternPositions.length !== wordPositions.length ||
                !patternPositions.every((pos, i) => pos === wordPositions[i])) {
                return false;
            }
        }
        return true;
    });
};

window.updatePossibleWords = function() {
    const wordsContent = document.getElementById('possible-words-content');
    const possibleWords = window.findPossibleWords(window.currentWord);
    
    const totalFreq = possibleWords.reduce((sum, word) => 
        sum + (window.WORD_FREQUENCIES[word] || 0), 0);
    
    const scoredWords = possibleWords.map(word => ({
        word: word,
        percentage: ((window.WORD_FREQUENCIES[word] || 0) / totalFreq * 100)
    })).sort((a, b) => b.percentage - a.percentage);
    
    wordsContent.innerHTML = '';
    
    scoredWords.slice(0, 20).forEach(({word, percentage}) => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-item';
        let confidenceLevel;
        if (percentage > 50) confidenceLevel = "Very likely";
        else if (percentage > 30) confidenceLevel = "Likely";
        else if (percentage > 10) confidenceLevel = "Possible";
        else confidenceLevel = "Slightly possible";
        
        wordDiv.innerHTML = `
            <span class="word-text">${word.toUpperCase()}</span>
            <span class="word-score">${confidenceLevel}</span>
        `;
        wordsContent.appendChild(wordDiv);
    });
};

window.updatePlayerDisplay = function() {
    const display = document.getElementById('player-word-display');
    display.innerHTML = window.currentWord
        .split('')
        .map((letter, index) => `
            <div class="letter-slot ${letter !== '_' ? 'filled' : ''}" 
                 data-index="${index + 1}"
                 onclick="handleSlotClick(${index + 1})">
                <span class="letter-slot-number">${index + 1}</span>
                ${letter === '_' ? '_' : letter.toUpperCase()}
            </div>
        `)
        .join('');
    
    document.getElementById('computer-guesses').textContent = 
        `Guessed letters: ${Array.from(window.guessedLetters).map(l => l.toUpperCase()).join(', ')}`;
        
    window.updatePossibleWords();
};

window.loadWordFrequencies = async function() {
    try {
        const response = await fetch('WordFrequency.csv');
        const text = await response.text();
        const lines = text.split('\n').slice(1);
        
        lines.forEach(line => {
            if (!line.trim()) return;
            
            const [word, freq] = line.split(',');
            if (word) {
                const cleanWord = word.trim().toLowerCase();
                if (/^[a-z]+$/.test(cleanWord)) {
                    window.WORD_FREQUENCIES[cleanWord] = parseInt(freq) || 0;
                }
            }
        });
        
        console.log('Word frequency data loaded');
    } catch (error) {
        console.error('Failed to load word frequency data:', error);
        const basicWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i'];
        basicWords.forEach((word, index) => {
            window.WORD_FREQUENCIES[word] = 1000000 - index * 100000;
        });
    }
};

window.submitGuessResult = function(exists) {
    const letter = window.currentGuessLetter;
    if (!letter) return;

    window.actualGuessCount++; // Increase actual guess count

    const oldWord = window.currentWord;
    const oldGuessedLetters = new Set(window.guessedLetters);
    const oldAttempts = window.remainingAttempts;
    
    if (!exists) {
        window.guessedLetters.add(letter);
        window.remainingAttempts--;
        window.showToast('Letter does not exist', 'warning');
        window.drawHangman(7 - window.remainingAttempts);
    } else {
        const posInput = document.getElementById('position-input');
        const positions = posInput.value.split(',')
            .map(pos => parseInt(pos.trim()) - 1)
            .filter(pos => pos >= 0 && pos < window.currentWord.length);
        
        if (positions.length === 0) {
            window.showToast('Please enter valid positions! (e.g., 1,3)', 'warning');
            return;
        }
        
        let wordArray = window.currentWord.split('');
        positions.forEach(pos => {
            wordArray[pos] = letter;
        });
        window.currentWord = wordArray.join('');
        window.guessedLetters.add(letter);
    }
    
    window.guessHistory.push({
        word: oldWord,
        guessedLetters: oldGuessedLetters,
        attempts: oldAttempts,
        letter: letter
    });
    
    document.getElementById('position-input').value = '';
    window.selectedPositions.clear();
    
    window.updatePlayerDisplay();
    
    if (window.checkComputerGameEnd()) {
        return;
    }
    
    setTimeout(window.computerGuess, 100);
};

window.undoLastGuess = function() {
    if (window.guessHistory.length === 0) {
        window.showToast('No operation to undo!', 'warning');
        return;
    }
    
    const lastState = window.guessHistory.pop();
    window.currentWord = lastState.word;
    window.guessedLetters = new Set(lastState.guessedLetters);
    window.remainingAttempts = lastState.attempts;
    window.actualGuessCount = Math.max(0, window.actualGuessCount - 1); // Decrease actual guess count
    
    window.selectedPositions.clear();
    window.updatePlayerDisplay();
    window.computerGuess();
    window.drawHangman(7 - window.remainingAttempts);
};

window.showToast = function(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-message">${message}</div>`;

    const container = document.getElementById('toast-container');
    if (container) {
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.handleSlotClick = function(position) {
    const slot = document.querySelector(`[data-index="${position}"]`);
    if (slot.classList.contains('filled')) return;
    
    if (window.selectedPositions.has(position)) {
        window.selectedPositions.delete(position);
        slot.classList.remove('selected');
    } else {
        window.selectedPositions.add(position);
        slot.classList.add('selected');
    }
    
    document.getElementById('position-input').value = 
        Array.from(window.selectedPositions).sort((a, b) => a - b).join(',');
};

window.checkComputerGameEnd = function() {
    const won = !window.currentWord.includes('_');
    
    if (won) {
        showSuccessfulPrediction(window.currentWord);
        setTimeout(() => {
            window.resetAssistantMode();
        }, 2000);
        return true;
    } else if (window.remainingAttempts <= 0) {
        showWordCheckDialog();
        return true;
    }
    return false;
};

window.showSuccessfulPrediction = function(word) {
    const usedLetters = Array.from(window.guessedLetters)
        .map(l => l.toUpperCase())
        .sort()
        .join(', ');
    
    // 检查是否是完美游戏（没有错误猜测）
    const isPerfectGame = window.remainingAttempts === 7; // 如果还剩7次机会，说明没有错误猜测
    
    const successMessage = `
        <div class="prediction-success">
            <div class="success-icon">🎯</div>
            <div class="success-title">${t('successTitle')}</div>
            <div class="success-details">
                <div class="detail-item">${t('word')}: <span class="highlight">${word.toUpperCase()}</span></div>
                <div class="detail-item">${t('length')}: <span class="highlight">${word.length}</span> ${t('letters')}</div>
                <div class="detail-item">${t('guesses')}: <span class="highlight">${window.actualGuessCount}</span></div>
                ${window.firstDetectedEmptyCount >= 3 ? 
                    `<div class="detail-item">${t('detectedWith')} <span class="highlight">${window.firstDetectedEmptyCount}</span> ${t('blanksRemaining')}!</div>` 
                    : ''}
                <div class="detail-item">${t('usedLetters')}: <span class="highlight">${usedLetters}</span></div>
            </div>
        </div>
    `;

    // 如果是完美游戏，显示特殊的完美游戏提示
    if (isPerfectGame) {
        window.showToast("Perfect Game! No wrong guesses!", "perfect-game");
    }

    const toast = document.createElement('div');
    toast.className = 'toast prediction-success-toast';
    toast.innerHTML = successMessage;

    const container = document.getElementById('toast-container');
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
};

window.showWordCheckDialog = function() {
    const dialog = document.createElement('div');
    dialog.className = 'word-check-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>❌ AI Analysis Failed</h3>
            <p>Please enter the word you were thinking of, so we can analyze what went wrong:</p>
            <input type="text" id="actual-word" placeholder="Enter the correct word" class="word-input">
            <div class="dialog-buttons">
                <button onclick="checkWord()" class="check-btn">Check Word</button>
                <button onclick="closeDialog()" class="close-btn">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
};

window.checkWord = function() {
    const input = document.getElementById('actual-word');
    const word = input.value.trim().toLowerCase();
    
    if (!word || !/^[a-z]+$/.test(word)) {
        window.showToast('Please enter a valid English word!', 'error');
        return;
    }

    let message;
    if (window.WORD_FREQUENCIES[word]) {
        message = `
            <div class="analysis-result">
                <p>This word exists in our database!</p>
                <p>Frequency Rank: ${Object.keys(window.WORD_FREQUENCIES).indexOf(word) + 1}</p>
                <p>Usage Frequency: ${window.WORD_FREQUENCIES[word]}</p>
                <p>Looks like there was an issue with our prediction algorithm 😅</p>
            </div>
        `;
    } else {
        message = `
            <div class="analysis-result">
                <p>Sorry, this word is not in our database!</p>
                <p>We'll continue to expand our word database to improve AI's recognition ability 🚀</p>
            </div>
        `;
    }

    const resultDiv = document.createElement('div');
    resultDiv.className = 'check-result';
    resultDiv.innerHTML = message;
    
    const dialogContent = document.querySelector('.dialog-content');
    const dialogButtons = document.querySelector('.dialog-buttons');
    if (dialogContent && dialogButtons) {
        // 替换按钮区域为结果，并添加关闭按钮
        dialogButtons.innerHTML = '<button onclick="closeDialog()" class="close-btn">Close</button>';
        // 在按钮前插入结果
        dialogButtons.insertAdjacentElement('beforebegin', resultDiv);
    }
};

window.closeDialog = function() {
    const dialog = document.querySelector('.word-check-dialog');
    if (dialog) {
        dialog.remove();
        window.resetAssistantMode();
    }
};

window.startAssistantMode = function() {
    const lengthInput = document.getElementById('word-length');
    const length = parseInt(lengthInput.value);
    
    if (!length || length < 1 || length > 15) {
        window.showToast('Please enter a length between 1-15!', 'error');
        return;
    }
    
    window.currentWord = '_'.repeat(length);
    document.getElementById('word-input-section').classList.add('hidden');
    document.getElementById('computer-guess-section').classList.remove('hidden');
    window.guessedLetters = new Set();
    window.remainingAttempts = 7;
    window.guessHistory = [];
    window.selectedPositions = new Set();
    window.actualGuessCount = 0;
    window.firstDetectedEmptyCount = null;
    
    // 先绘制绞刑架
    const canvas = document.getElementById('hangman-canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 3;
    
    // 绘制绞刑架
    ctx.beginPath();
    // 底座
    ctx.moveTo(20, 180);
    ctx.lineTo(180, 180);
    // 立柱
    ctx.moveTo(40, 180);
    ctx.lineTo(40, 20);
    // 横梁
    ctx.moveTo(40, 20);
    ctx.lineTo(120, 20);
    // 绳子
    ctx.moveTo(120, 20);
    ctx.lineTo(120, 40);
    ctx.stroke();
    
    window.updatePlayerDisplay();
    window.computerGuess();
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadWordFrequencies();
    console.log('页面初始化完成');
});

window.computerGuess = function() {
    if (window.remainingAttempts <= 0) {
        window.showToast('AI has no more attempts!', 'error');
        return;
    }

    const possibleWords = window.findPossibleWords(window.currentWord);
    if (possibleWords.length === 0) {
        window.showToast('No matching words found, please check your input!', 'warning');
        return;
    }

    const totalFreq = possibleWords.reduce((sum, word) => 
        sum + (window.WORD_FREQUENCIES[word] || 0), 0);
    
    const topWord = possibleWords
        .map(word => ({
            word: word,
            percentage: ((window.WORD_FREQUENCIES[word] || 0) / totalFreq * 100)
        }))
        .sort((a, b) => b.percentage - a.percentage)[0];

    const thinkingStatus = document.getElementById('ai-thinking-status');
    
    if (topWord) {
        if (topWord.percentage === 100) {
            thinkingStatus.innerHTML = `
                <div class="prediction-certain">
                    <div class="prediction-title">${t('thisIsIt')}</div>
                    <div class="prediction-word">${topWord.word.toUpperCase()}</div>
                </div>
            `;
            window.confirmWord(topWord.word);
            return;
        } else if (topWord.percentage > 50) {
            thinkingStatus.innerHTML = `
                <div class="prediction-high">
                    <div class="prediction-title">${t('quiteConfident')}</div>
                    <div class="prediction-word">${topWord.word.toUpperCase()}</div>
                    <div class="prediction-buttons">
                        <button onclick="confirmWord('${topWord.word}')" class="mini-confirm-btn">${t('yes')}</button>
                        <button onclick="rejectWord('${topWord.word}')" class="mini-reject-btn">${t('no')}</button>
                    </div>
                </div>
            `;
        } else if (window.isPatternDetected()) {
            thinkingStatus.innerHTML = `
                <div class="prediction-pattern">
                    <div class="prediction-title">${t('patternDetected')}</div>
                    <div class="prediction-detail">${t('analyzing')}</div>
                </div>
            `;
        } else if (topWord.percentage < 10) {
            thinkingStatus.innerHTML = `
                <div class="prediction-confused">
                    <div class="prediction-title">${t('clueless')}</div>
                    <div class="prediction-detail">
                        <div>${t('thinking')}</div>
                    </div>
                </div>
            `;
        } else {
            thinkingStatus.innerHTML = `
                <div class="prediction-low">
                    <div class="prediction-title">${t('couldBe')}</div>
                    <div class="prediction-word">${topWord.word.toUpperCase()}</div>
                </div>
            `;
        }
    }

    const guessResult = window.getSmartGuess();
    if (!guessResult || !guessResult.bestGuess) {
        window.showToast('AI cannot continue analysis!', 'error');
        return;
    }
    
    // 更新预测字母和推荐字母的显示
    const recommendationsDiv = document.getElementById('letter-recommendations');
    if (guessResult.recommendations.length > 0) {
        // 主预测字母也做成可点击的
        document.querySelector('.prediction-main').innerHTML = 
            `AI Predicted Letter: <span id="current-guess" class="predicted-letter recommended-letter" onclick="selectRecommendedLetter('${guessResult.bestGuess}')">${guessResult.bestGuess.toUpperCase()}</span>`;
        
        // 添加推荐字母
        recommendationsDiv.innerHTML = `
            You can also try: ${guessResult.recommendations
                .map(l => `<span class="recommended-letter" onclick="selectRecommendedLetter('${l}')">${l.toUpperCase()}</span>`)
                .join(', ')}
        `;
        recommendationsDiv.style.display = 'block';
    } else {
        document.querySelector('.prediction-main').innerHTML = 
            `AI Predicted Letter: <span id="current-guess" class="predicted-letter">${guessResult.bestGuess.toUpperCase()}</span>`;
        recommendationsDiv.style.display = 'none';
    }

    // 设置当前字母
    window.currentGuessLetter = guessResult.bestGuess;
    
    // 初始高亮主预测字母
    const allLetters = document.querySelectorAll('.recommended-letter');
    allLetters.forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === guessResult.bestGuess.toUpperCase());
    });

    if (topWord && topWord.percentage > 50 && window.firstDetectedEmptyCount === null) {
        window.firstDetectedEmptyCount = window.currentWord.split('').filter(char => char === '_').length;
    }
};

window.resetAssistantMode = function() {
    document.getElementById('word-input-section').classList.remove('hidden');
    document.getElementById('computer-guess-section').classList.add('hidden');
    document.getElementById('word-length').value = '';
    window.selectedPositions.clear();
};

window.COMMON_PATTERNS = {
    suffixes: {
        'tion': ['t', 'i', 'o', 'n'],
        'sion': ['s', 'i', 'o', 'n'],
        'ing': ['i', 'n', 'g'],
        'ed': ['e', 'd'],
        'ly': ['l', 'y'],
        'ment': ['m', 'e', 'n', 't'],
        'ness': ['n', 'e', 's', 's'],
        'able': ['a', 'b', 'l', 'e'],
        'ible': ['i', 'b', 'l', 'e'],
        'ful': ['f', 'u', 'l'],
        'ity': ['i', 't', 'y'],
        'ous': ['o', 'u', 's'],
        'al': ['a', 'l'],
        'er': ['e', 'r'],
        'est': ['e', 's', 't']
    },
    prefixes: {
        'un': ['u', 'n'],
        'in': ['i', 'n'],
        'dis': ['d', 'i', 's'],
        're': ['r', 'e'],
        'pre': ['p', 'r', 'e'],
        'pro': ['p', 'r', 'o'],
        'con': ['c', 'o', 'n'],
        'com': ['c', 'o', 'm'],
        'en': ['e', 'n'],
        'em': ['e', 'm']
    }
};

window.isPatternDetected = function() {
    const pattern = window.currentWord.split('');
    
    for (const [suffix, letters] of Object.entries(window.COMMON_PATTERNS.suffixes)) {
        if (pattern.length >= letters.length) {
            const endPart = pattern.slice(-letters.length);
            const matchedLetters = endPart.filter((char, i) => 
                char !== '_' && char === letters[i]
            ).length;
            
            if (matchedLetters >= letters.length / 2) {
                return true;
            }
        }
    }
    
    for (const [prefix, letters] of Object.entries(window.COMMON_PATTERNS.prefixes)) {
        if (pattern.length >= letters.length) {
            const startPart = pattern.slice(0, letters.length);
            const matchedLetters = startPart.filter((char, i) => 
                char !== '_' && char === letters[i]
            ).length;
            
            if (matchedLetters >= letters.length / 2) {
                return true;
            }
        }
    }
    
    return false;
};

window.getDetectedPattern = function() {
    const pattern = window.currentWord.split('');
    
    for (const [suffix, letters] of Object.entries(window.COMMON_PATTERNS.suffixes)) {
        if (pattern.length >= letters.length) {
            const endPart = pattern.slice(-letters.length);
            const matchedLetters = endPart.filter((char, i) => 
                char !== '_' && char === letters[i]
            ).length;
            
            if (matchedLetters >= letters.length / 2) {
                return {
                    type: 'suffix',
                    pattern: suffix
                };
            }
        }
    }
    
    for (const [prefix, letters] of Object.entries(window.COMMON_PATTERNS.prefixes)) {
        if (pattern.length >= letters.length) {
            const startPart = pattern.slice(0, letters.length);
            const matchedLetters = startPart.filter((char, i) => 
                char !== '_' && char === letters[i]
            ).length;
            
            if (matchedLetters >= letters.length / 2) {
                return {
                    type: 'prefix',
                    pattern: prefix
                };
            }
        }
    }
    
    return null;
};

// 获取智能猜测
window.getSmartGuess = function() {
    if (window.guessedLetters.size === 0) {
        return {
            bestGuess: 'e',
            recommendations: []
        };
    }

    const possibleWords = window.findPossibleWords(window.currentWord);
    if (possibleWords.length === 0) return null;
    
    const pattern = window.currentWord.split('');
    const commonLetters = new Set();
    
    pattern.forEach((char, index) => {
        if (char === '_') {
            const lettersAtPosition = new Set(
                possibleWords.map(word => word[index])
            );
            if (lettersAtPosition.size === 1) {
                commonLetters.add([...lettersAtPosition][0]);
            }
        }
    });
    
    // 获取所有字母的分数
    const letterScores = {};
    const unguessedLetters = 'abcdefghijklmnopqrstuvwxyz'
        .split('')
        .filter(letter => 
            !window.guessedLetters.has(letter) && 
            !commonLetters.has(letter)
        );
        
    for (let letter of unguessedLetters) {
        letterScores[letter] = window.LETTER_FREQUENCIES[letter];
        
        const wordFreqSum = possibleWords
            .filter(word => word.includes(letter))
            .reduce((sum, word) => sum + (window.WORD_FREQUENCIES[word] || 0), 0);
            
        const totalFreq = possibleWords
            .reduce((sum, word) => sum + (window.WORD_FREQUENCIES[word] || 0), 0);
            
        letterScores[letter] += (wordFreqSum / totalFreq) * 100;
    }
    
    // 按分数排序所有字母
    const sortedLetters = Object.entries(letterScores)
        .sort(([,a], [,b]) => b - a);
    
    // 获取最佳猜测
    const bestGuess = sortedLetters[0]?.[0] || null;
    
    // 获取分数超过最高分1/3的推荐字母（不包括最佳猜测）
    const maxScore = sortedLetters[0]?.[1] || 0;
    const threshold = maxScore / 3;
    const recommendations = sortedLetters
        .slice(1) // 跳过最佳猜测
        .filter(([, score]) => score >= threshold)
        .map(([letter]) => letter)
        .slice(0, 5); // 最多5个推荐

    return {
        bestGuess,
        recommendations
    };
};

window.confirmWord = function(word) {
    if (!word) return;
    
    const newLetters = new Set(word.split(''))
        .difference(window.guessedLetters);
    
    window.currentWord = word;
    newLetters.forEach(letter => window.guessedLetters.add(letter));
    
    window.showSuccessfulPrediction(word);
    
    setTimeout(() => {
        window.resetAssistantMode();
    }, 2000);
};

window.rejectWord = function(word) {
    if (!word) return;
    
    window.WORD_FREQUENCIES[word] = 0;
    
    const guess = window.getSmartGuess();
    if (guess) {
        document.getElementById('current-guess').textContent = guess.toUpperCase();
        window.currentGuessLetter = guess;
    }
    
    window.updatePlayerDisplay();
};

// 添加语言设置
window.LANGUAGE = 'en';  // 默认英文

// 添加语言包
window.TRANSLATIONS = {
    en: {
        successTitle: "AI Successfully Cracked!",
        word: "Word",
        length: "Length",
        letters: "letters",
        guesses: "guesses",
        usedLetters: "Used letters",
        detectedWith: "Detected with",
        blanksRemaining: "blanks remaining",
        thisIsIt: "This is it!",
        quiteConfident: "I'm quite confident it's this",
        yes: "Yes",
        no: "No",
        patternDetected: "I think I see a pattern",
        analyzing: "Analyzing possible combinations...",
        clueless: "Still clueless...",
        thinking: "Let me think about it 🤔",
        couldBe: "Could be this",
        letterNotExist: "Letter does not exist",
        enterValidPositions: "Please enter valid positions! (e.g., 1,3)",
        noUndo: "No operation to undo!",
        enterLength: "Please enter a length between 1-15!",
        noMatch: "No matching words found, please check your input!",
        cantAnalyze: "AI cannot continue analysis!"
    },
    zh: {
        successTitle: "AI 智能破解成功！",
        word: "破解单词",
        length: "单词长度",
        letters: "个字母",
        guesses: "次猜测",
        usedLetters: "使用字母",
        detectedWith: "在还有",
        blanksRemaining: "个空位时就已猜出",
        thisIsIt: "就是这个！",
        quiteConfident: "我觉得很有可能是这个",
        yes: "是",
        no: "否",
        patternDetected: "我好像认出了前缀/后缀",
        analyzing: "正在分析可能的组合...",
        clueless: "我还毫无头绪...",
        thinking: "让我继续分析下 🤔",
        couldBe: "说不定是这个",
        letterNotExist: "字母不存在",
        enterValidPositions: "请输入有效的位置！(如: 1,3)",
        noUndo: "没有可以撤销的操作！",
        enterLength: "请输入1-15之间的单词长度！",
        noMatch: "未找到匹配的单词，请检查输入是否正确！",
        cantAnalyze: "AI无法继续分析！"
    }
};

// 添加获取翻译的辅助函数
function t(key) {
    return window.TRANSLATIONS[window.LANGUAGE][key];
}

// 添加语言切换函数
window.switchLanguage = function(lang) {
    window.LANGUAGE = lang;
    
    // 更新按钮状态
    document.getElementById('en-btn').classList.toggle('active', lang === 'en');
    document.getElementById('zh-btn').classList.toggle('active', lang === 'zh');
    
    // 更新界面显示
    window.updatePlayerDisplay();
    window.computerGuess();
};

// 在页面加载时设置初始语言状态
document.addEventListener('DOMContentLoaded', function() {
    // 设置默认语言按钮状态
    document.getElementById('en-btn').classList.add('active');
});

// 添加绘制函数
window.drawHangman = function(mistakes) {
    const canvas = document.getElementById('hangman-canvas');
    const ctx = canvas.getContext('2d');
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 3;
    
    // 绘制绞刑架
    ctx.beginPath();
    // 底座
    ctx.moveTo(20, 180);
    ctx.lineTo(180, 180);
    // 立柱
    ctx.moveTo(40, 180);
    ctx.lineTo(40, 20);
    // 横梁
    ctx.moveTo(40, 20);
    ctx.lineTo(120, 20);
    // 绳子
    ctx.moveTo(120, 20);
    ctx.lineTo(120, 40);
    ctx.stroke();
    
    // 根据错误次数绘制小人
    if (mistakes >= 1) {
        // 头
        ctx.beginPath();
        ctx.arc(120, 55, 15, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (mistakes >= 2) {
        // 身体
        ctx.beginPath();
        ctx.moveTo(120, 70);
        ctx.lineTo(120, 120);
        ctx.stroke();
    }
    if (mistakes >= 3) {
        // 左臂
        ctx.beginPath();
        ctx.moveTo(120, 80);
        ctx.lineTo(90, 100);
        ctx.stroke();
    }
    if (mistakes >= 4) {
        // 右臂
        ctx.beginPath();
        ctx.moveTo(120, 80);
        ctx.lineTo(150, 100);
        ctx.stroke();
    }
    if (mistakes >= 5) {
        // 左腿
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(90, 150);
        ctx.stroke();
    }
    if (mistakes >= 6) {
        // 右腿
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(150, 150);
        ctx.stroke();
    }
};

// 修改选择推荐字母的函数
window.selectRecommendedLetter = function(letter) {
    window.currentGuessLetter = letter;
    
    // 更新所有字母的高亮状态
    const allLetters = document.querySelectorAll('.recommended-letter');
    allLetters.forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === letter.toUpperCase());
    });
};

// 在游戏结束时检查是否是完美游戏
function checkGameEnd() {
    // 现有的游戏结束检查代码...
    
    if (isGameWon) {
        if (wrongGuesses.length === 0) {
            // 显示完美游戏消息
            showToast("完美游戏！没有任何错误猜测！", "perfect-game");
        } else {
            // 普通获胜消息
            showToast("恭喜！你赢了！");
        }
    }
}

// 修改 showToast 函数以支持自定义样式
function showToast(message, className = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${className}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}