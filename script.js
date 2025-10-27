// ポモドロタイマー & RPG統合アプリケーション - リファクタリング版

// ========================================
// メインアプリケーションクラス
// ========================================
class PomodoroApp {
    constructor() {
        this.TIMER_DURATION = 25 * 60; // 25分
        
        this.state = {
            timer: this.TIMER_DURATION,
            isRunning: false,
            startTime: null,
            gameTimerId: null,
            isMuted: false
        };
        
        // システム初期化
        this.taskManager = new TaskManager();
        this.gameSystem = new GameSystem();
        this.animationSystem = new AnimationSystem();
        
        // アラーム音の初期化
        this.alarmSound = new Audio('sound/alarm.mp3');
        this.alarmSound.preload = 'auto';
        
        this.init();
    }
    
    init() {
        this.updateDisplay();
        this.gameSystem.updateDisplay();
        this.bindEvents();
        this.validateBPM();
        this.updateMuteButton();
    }
    
    bindEvents() {
        document.getElementById('startbtn').addEventListener('click', () => this.toggleTimer());
        document.getElementById('resetbtn').addEventListener('click', () => this.resetTimer());
        document.getElementById('bpmInput').addEventListener('input', () => this.handleBPMChange());
        document.getElementById('exportbtn').addEventListener('click', () => this.taskManager.exportData());
        document.getElementById('mutebtn').addEventListener('click', () => this.toggleMute());
        
        // ページ同期イベント
        document.addEventListener('visibilitychange', () => this.syncTimer());
        window.addEventListener('focus', () => this.syncTimer());
    }
    
    toggleTimer() {
        this.state.isRunning ? this.stopTimer() : this.startTimer();
    }
    
    startTimer() {
        this.state.isRunning = true;
        this.state.startTime = Date.now();
        
        document.getElementById('startbtn').textContent = 'ストップ';
        
        this.animationSystem.start(this.validateBPM());
        this.gameSystem.startExploration();
        
        this.state.gameTimerId = setInterval(() => {
            if (this.updateTimer() <= 0) {
                this.completePomodoro();
            }
        }, 1000);
    }
    
    stopTimer() {
        this.state.isRunning = false;
        this.state.startTime = null;
        
        if (this.state.gameTimerId) {
            clearInterval(this.state.gameTimerId);
            this.state.gameTimerId = null;
        }
        
        document.getElementById('startbtn').textContent = 'スタート';
        this.animationSystem.stop();
        this.gameSystem.stopExploration();
    }
    
    resetTimer() {
        this.stopTimer();
        this.state.timer = this.TIMER_DURATION;
        this.updateDisplay();
        this.animationSystem.resetCharacter();
        this.gameSystem.clearBoxes();
    }
    
    completePomodoro() {
        this.stopTimer();
        this.playAlarm();
        
        const taskName = document.getElementById('taskInput').value || '無題のタスク';
        this.taskManager.recordCompletion(taskName);
        this.gameSystem.completeExploration();
        
        // 自動リセット
        this.state.timer = this.TIMER_DURATION;
        this.updateDisplay();
        this.animationSystem.resetCharacter();
    }
    
    playAlarm() {
        if (this.state.isMuted) {
            this.fallbackNotification();
            return;
        }
        
        try {
            this.alarmSound.currentTime = 0;
            this.alarmSound.play().catch(error => {
                console.warn('アラーム音の再生に失敗しました:', error);
                this.fallbackNotification();
            });
        } catch (error) {
            console.warn('アラーム音の初期化に失敗しました:', error);
            this.fallbackNotification();
        }
    }
    
    fallbackNotification() {
        if ('speechSynthesis' in window && !this.state.isMuted) {
            const utterance = new SpeechSynthesisUtterance('ポモドーロ完了');
            utterance.volume = 0.1;
            speechSynthesis.speak(utterance);
        }
        
        document.title = '🔔 ポモドーロ完了! - ポモドロ子';
        setTimeout(() => { document.title = 'ポモドロ子'; }, 5000);
    }
    
    toggleMute() {
        this.state.isMuted = !this.state.isMuted;
        this.updateMuteButton();
    }
    
    updateMuteButton() {
        const muteBtn = document.getElementById('mutebtn');
        const isMuted = this.state.isMuted;
        
        muteBtn.textContent = isMuted ? '🔇アラームなし' : '🔊アラームあり';
        muteBtn.title = isMuted ? 'アラーム音をオンにする' : 'アラーム音をオフにする';
        muteBtn.classList.toggle('muted', isMuted);
    }
    
    updateTimer() {
        if (!this.state.startTime) return this.state.timer;
        
        const elapsed = Math.floor((Date.now() - this.state.startTime) / 1000);
        const remaining = Math.max(0, this.TIMER_DURATION - elapsed);
        
        this.state.timer = remaining;
        this.updateDisplay();
        return remaining;
    }
    
    syncTimer() {
        if (this.state.isRunning && this.state.startTime) {
            this.updateTimer();
        }
    }
    
    updateDisplay() {
        const minutes = String(Math.floor(this.state.timer / 60)).padStart(2, '0');
        const seconds = String(this.state.timer % 60).padStart(2, '0');
        const timerDisplay = document.getElementById('timerDisplay') || document.getElementById('timer');
        
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes}:${seconds}`;
        }
    }
    
    handleBPMChange() {
        const bpm = this.validateBPM();
        if (this.state.isRunning) {
            this.animationSystem.updateSpeed(bpm);
        }
    }
    
    validateBPM() {
        const input = document.getElementById('bpmInput');
        let bpm = parseInt(input.value) || 120;
        bpm = Math.max(1, Math.min(300, bpm));
        input.value = bpm;
        return bpm;
    }
}

// ========================================
// アニメーションシステム
// ========================================
class AnimationSystem {
    constructor() {
        this.frameCount = 6;
        this.currentFrame = 1;
        this.intervalId = null;
    }
    
    start(bpm) {
        this.stop();
        const interval = (60 / bpm) * 1000 / 3;
        this.intervalId = setInterval(() => this.updateFrame(), interval);
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    updateSpeed(bpm) {
        if (this.intervalId) {
            this.start(bpm);
        }
    }
    
    updateFrame() {
        this.currentFrame = (this.currentFrame % this.frameCount) + 1;
        document.getElementById('character').src = `images/walk${this.currentFrame}.png`;
    }
    
    resetCharacter() {
        this.currentFrame = 1;
        document.getElementById('character').src = 'images/walk1.png';
    }
}

// ========================================
// タスク管理システム
// ========================================
class TaskManager {
    constructor() {
        this.data = this.loadData();
        this.updateUI();
    }
    
    loadData() {
        const saved = localStorage.getItem('pomodoroTasks');
        return saved ? JSON.parse(saved) : { tasks: [], completions: [] };
    }
    
    saveData() {
        localStorage.setItem('pomodoroTasks', JSON.stringify(this.data));
    }
    
    recordCompletion(taskName) {
        taskName = taskName.trim() || '無題のタスク';
        
        if (!this.data.tasks.includes(taskName)) {
            this.data.tasks.push(taskName);
        }
        
        this.data.completions.push({
            taskName,
            date: new Date().toDateString(),
            timestamp: new Date().toISOString()
        });
        
        this.saveData();
        this.updateUI();
    }
    
    updateUI() {
        this.updateSuggestions();
        this.displayRecords();
    }
    
    updateSuggestions() {
        const datalist = document.getElementById('taskSuggestions');
        datalist.innerHTML = '';
        
        const frequency = {};
        this.data.completions.forEach(c => {
            frequency[c.taskName] = (frequency[c.taskName] || 0) + 1;
        });
        
        const sorted = this.data.tasks.sort((a, b) => (frequency[b] || 0) - (frequency[a] || 0));
        
        sorted.forEach(task => {
            const option = document.createElement('option');
            option.value = task;
            datalist.appendChild(option);
        });
        
        document.getElementById('taskInput').setAttribute('list', 'taskSuggestions');
    }
    
    displayRecords() {
        const container = document.getElementById('recordsList');
        
        if (this.data.completions.length === 0) {
            container.innerHTML = '記録はありません';
            return;
        }
        
        const grouped = {};
        this.data.completions.forEach(completion => {
            const { date, taskName } = completion;
            if (!grouped[date]) grouped[date] = {};
            grouped[date][taskName] = (grouped[date][taskName] || 0) + 1;
        });
        
        const html = Object.keys(grouped)
            .sort((a, b) => new Date(b) - new Date(a))
            .map(date => {
                const tasks = Object.entries(grouped[date])
                    .map(([task, count]) => `<li>${task}: ${count}回完了</li>`)
                    .join('');
                return `<div style="margin-bottom: 10px;"><strong>${date}</strong><ul style="margin: 5px 0;">${tasks}</ul></div>`;
            })
            .join('');
        
        container.innerHTML = html;
    }
    
    exportData() {
        const csvHeader = 'タスク名,完了日時,所要時間(分),メモ\n';
        
        const csvRows = this.data.completions.map(completion => {
            const taskName = completion.task || '未設定';
            const completedAt = new Date(completion.timestamp).toLocaleString('ja-JP');
            const duration = Math.round(completion.duration / 60);
            const memo = '';
            
            const escapeCSV = (value) => {
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            };
            
            return `${escapeCSV(taskName)},${escapeCSV(completedAt)},${duration},${escapeCSV(memo)}`;
        }).join('\n');
        
        const csvContent = csvHeader + csvRows;
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ポモドロ記録-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ========================================
// ゲームシステム
// ========================================
class GameSystem {
    constructor() {
        this.playerData = this.loadPlayerData();
        this.itemBoxes = [];
        this.explorationTimer = null;
        this.startTime = null;
        this.itemData = null;
        
        this.loadItemData();
    }
    
    async loadItemData() {
        try {
            if (window.location.protocol === 'file:') {
                this.itemData = this.getFallbackItemData();
                return;
            }
            
            const response = await fetch('items.json');
            this.itemData = await response.json();
        } catch (error) {
            console.warn('アイテムデータの読み込みに失敗しました。フォールバックデータを使用します');
            this.itemData = this.getFallbackItemData();
        }
    }
    
    getFallbackItemData() {
        return {
            items: {
                common: ['サビたスプーン', 'オイル切れライター', 'アルミの弁当箱', '折れた鉛筆の芯', 'カエルの指人形', 'ペットボトルロケット', '手書きの魔法陣', 'カフェのポイントカード', '5色ボールペン', '充電ケーブル', '缶コーヒー', '理髪店のサインポール', '熊の置物', 'りんご', '小銭', 'くたびれた長靴', '呼び鈴', 'トランプ', 'インスタントカメラ', 'めざまし時計'],
                rare: ['魔法の水晶', '古代の書物', '光る石', '銀の指輪', '精霊の羽'],
                epic: ['ドラゴンの鱗', '賢者の杖', '時の砂時計', '聖なる盾', '不死鳥の羽根'],
                legendary: ['世界樹の葉', '創造の石', '無限の知識', '星の欠片', '真理の書']
            },
            descriptions: {
                'サビたスプーン': '壁を掘るには心もとない',
                'オイル切れライター': 'もう役目を終えている',
                'アルミの弁当箱': 'フタがピッタリはまると気持ちいい',
                '折れた鉛筆の芯': 'どうやって芯だけ見つけたんだろう',
                'カエルの指人形': '小さい頃、薬局で見たことがある',
                'ペットボトルロケット': 'ヒトに向けてはいけません',
                '手書きの魔法陣': '裏はレシート',
                'カフェのポイントカード': 'スタンプが1つ押してある',
                '5色ボールペン': '大人になると買わなくなるかも',
                '充電ケーブル': 'ラベルにはvodafoneと書いてある',
                '缶コーヒー': 'インスタントお茶会用',
                '理髪店のサインポール': 'イギリスでは赤と白の2色らしい',
                '熊の置物': '当然のように鮭を咥えている',
                'りんご': 'アップルパイやタタンがすき！',
                '小銭': 'これで迷ったときにコイントスできるよ',
                'くたびれた長靴': '中に雨水が溜まっている',
                '呼び鈴': '山を歩く時に使えるかも？',
                'トランプ': 'ドレスもシュラフもほしい',
                'インスタントカメラ': 'なにが写っているのか気になる',
                'めざまし時計': 'たまには距離をおきたくなるよね',
                '魔法の水晶': '魔力を宿した美しい水晶。触れると温かい。',
                '古代の書物': '古代文字で書かれた謎の書物。知識の宝庫だ。',
                '光る石': '暗闇でも光を放つ不思議な石。道標として使えそう。',
                '銀の指輪': '精巧な細工が施された銀製の指輪。高価そうだ。',
                '精霊の羽': '風の精霊が落とした羽根。軽やかで美しい。',
                'ドラゴンの鱗': '伝説のドラゴンの鱗。とても硬く、貴重な防具の材料。',
                '賢者の杖': '古の賢者が愛用した杖。知恵の力が宿っている。',
                '時の砂時計': '時を操ると言われる神秘的な砂時計。',
                '聖なる盾': '神に祝福された盾。あらゆる災いを防ぐ。',
                '不死鳥の羽根': '不死鳥の美しい羽根。再生の力を持つという。',
                '世界樹の葉': '世界の中心に立つ巨大な樹の葉。生命力に満ちている。',
                '創造の石': '世界を創造したとされる神秘の石。無限の可能性を秘める。',
                '無限の知識': '全ての知識が込められた結晶体。真理への扉だ。',
                '星の欠片': '夜空から落ちた星の欠片。宇宙の神秘が宿る。',
                '真理の書': '世界の真理が記された究極の書物。読む者を選ぶ。'
            },
            boxImages: {
                common: 'images/Common_box.png',
                rare: 'images/Rare_box.png',
                epic: 'images/Epic_box.png',
                legendary: 'images/Legendary_box.png'
            },
            rarityColors: {
                common: '#8B4513',
                rare: '#4169E1',
                epic: '#9932CC',
                legendary: '#FFD700'
            },
            experienceBonuses: {
                common: 0,
                rare: 10,
                epic: 25,
                legendary: 50
            }
        };
    }
    
    loadPlayerData() {
        const saved = localStorage.getItem('pomodoroGameData');
        return saved ? JSON.parse(saved) : {
            level: 1,
            exp: 0,
            totalItems: 0,
            inventory: {},
            discoveredItems: {},
            totalPomodoros: 0
        };
    }
    
    savePlayerData() {
        localStorage.setItem('pomodoroGameData', JSON.stringify(this.playerData));
    }
    
    startExploration() {
        this.itemBoxes = [];
        this.startTime = Date.now();
        this.updateItemBoxDisplay();
        
        this.explorationTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const expectedBoxes = Math.min(5, Math.floor(elapsed / (5 * 60)));
            
            while (this.itemBoxes.length < expectedBoxes) {
                this.addItemBox();
            }
        }, 1000);
    }
    
    stopExploration() {
        if (this.explorationTimer) {
            clearInterval(this.explorationTimer);
            this.explorationTimer = null;
        }
        this.startTime = null;
    }
    
    clearBoxes() {
        this.itemBoxes = [];
        this.updateItemBoxDisplay();
    }
    
    addItemBox() {
        const rarity = this.determineRarity();
        this.itemBoxes.push({ rarity, item: null });
        this.updateItemBoxDisplay();
    }
    
    determineRarity() {
        const levelBonus = (this.playerData.level - 1) * 0.5;
        const random = Math.random() * 100;
        
        if (random < 0.5 + levelBonus) return 'legendary';
        if (random < 4 + levelBonus) return 'epic';
        if (random < 15 + levelBonus) return 'rare';
        return 'common';
    }
    
    updateItemBoxDisplay() {
        const container = document.getElementById('itemBoxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!this.itemData) return;
        
        this.itemBoxes.forEach(box => {
            const img = document.createElement('img');
            img.src = this.itemData.boxImages[box.rarity];
            img.style.cssText = 'width: 24px; height: 24px; image-rendering: pixelated; margin: 2px;';
            img.title = `${box.rarity} アイテムボックス`;
            container.appendChild(img);
        });
    }
    
    completeExploration() {
        this.stopExploration();
        
        if (!this.itemData) {
            this.itemData = this.getFallbackItemData();
        }
        
        const foundItems = [];
        let totalExpBonus = 0;
        
        this.itemBoxes.forEach(box => {
            const itemList = this.itemData.items[box.rarity];
            const item = itemList[Math.floor(Math.random() * itemList.length)];
            
            box.item = item;
            foundItems.push({ name: item, rarity: box.rarity });
            
            this.playerData.inventory[item] = (this.playerData.inventory[item] || 0) + 1;
            this.playerData.discoveredItems[item] = box.rarity;
            
            totalExpBonus += this.itemData.experienceBonuses[box.rarity];
        });
        
        const totalExp = 100 + totalExpBonus;
        const oldLevel = this.playerData.level;
        
        this.playerData.exp += totalExp;
        this.playerData.totalItems += foundItems.length;
        this.playerData.totalPomodoros++;
        this.playerData.level = Math.floor(this.playerData.exp / 100) + 1;
        
        const leveledUp = this.playerData.level > oldLevel;
        
        this.savePlayerData();
        this.updateDisplay();
        this.showResult(foundItems, totalExp, leveledUp);
        
        this.itemBoxes = [];
        this.updateItemBoxDisplay();
    }
    
    showResult(items, exp, leveledUp) {
        const modal = document.getElementById('resultModal');
        const background = document.getElementById('modalBackground');
        
        if (!modal || !background) {
            console.error('モーダル要素が見つかりません');
            return;
        }
        
        if (!this.itemData) {
            this.itemData = this.getFallbackItemData();
        }
        
        const itemsHtml = items.length > 0 
            ? items.map(item => 
                `<span style="color: ${this.itemData.rarityColors[item.rarity]};">• ${item.name} (${item.rarity})</span>`
              ).join('<br>')
            : '<span style="color: #999;">アイテムは見つかりませんでした</span>';
        
        this.setElementContent('foundItems', `<strong>🎁 発見したアイテム:</strong><br>${itemsHtml}`);
        this.setElementContent('expGained', `✨経験値 +${exp}`);
        
        const levelUpDiv = document.getElementById('levelUpMessage');
        if (levelUpDiv) {
            if (leveledUp) {
                levelUpDiv.innerHTML = `🎉 レベルアップ！ Lv.${this.playerData.level}`;
                levelUpDiv.style.display = 'block';
            } else {
                levelUpDiv.style.display = 'none';
            }
        }
        
        modal.style.display = 'block';
        background.style.display = 'block';
    }
    
    getPlayerTitle(level) {
        if (level >= 50) return "ポモドロマスター";
        if (level >= 40) return "ツアーガイド";
        if (level >= 30) return "ポモドロ名人";
        if (level >= 25) return "散歩が大好き";
        if (level >= 20) return "敬虔ポモドラー";
        if (level >= 15) return "蒐集上手";
        if (level >= 10) return "25分間の探索者";
        if (level >= 5) return "ポモドロ慣れ";
        return "初級ポモドラー";
    }

    updateDisplay() {
        const level = this.playerData.level;
        const title = this.getPlayerTitle(level);
        
        this.setElementContent('level', level);
        this.setElementContent('currentExp', this.playerData.exp % 100);
        this.setElementContent('nextExp', '100');
        
        const playerLevelElement = document.getElementById('playerLevel');
        if (playerLevelElement) {
            playerLevelElement.innerHTML = `Lv.<span id="level">${level}</span>  ${title}`;
        }
        
        const expPercent = this.playerData.exp % 100;
        const expBarElement = document.getElementById('expBar');
        if (expBarElement) {
            expBarElement.style.width = expPercent + '%';
        }
        
        const floor = Math.floor(this.playerData.totalPomodoros / 10) + 1;
        this.setElementContent('dungeonInfo', `📍 迷宮 ${floor}F を探索中`);
    }
    
    setElementContent(id, content) {
        const element = document.getElementById(id);
        if (element) {
            if (typeof content === 'string' && content.includes('<')) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
        }
    }
}

// ========================================
// タブシステム
// ========================================
class TabSystem {
    constructor() {
        this.currentTab = 'tasks';
        this.init();
    }
    
    init() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        document.querySelectorAll('.rarity-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setRarityFilter(e.target.dataset.rarity);
            });
        });
    }
    
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === tabName;
            btn.style.backgroundColor = isActive ? '#73cac6' : '#DDD';
            btn.style.color = isActive ? 'white' : '#666';
            btn.classList.toggle('active', isActive);
        });
        
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        const targetPanel = document.getElementById(`${tabName}Tab`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        }
        
        this.currentTab = tabName;
        
        if (tabName === 'items') {
            this.updateItemCatalog();
        } else if (tabName === 'stats') {
            this.updateStats();
        }
    }
    
    setRarityFilter(rarity) {
        document.querySelectorAll('.rarity-filter').forEach(btn => {
            const isActive = btn.dataset.rarity === rarity;
            btn.style.backgroundColor = isActive ? '#f0f0f0' : 'white';
            btn.classList.toggle('active', isActive);
        });
        
        document.querySelectorAll('.item-card').forEach(card => {
            card.style.display = (rarity === 'all' || card.dataset.rarity === rarity) ? 'block' : 'none';
        });
    }
    
    updateItemCatalog() {
        const gameSystem = app.gameSystem;
        const itemGrid = document.getElementById('itemGrid');
        const completionRate = document.getElementById('completionRate');
        
        if (!gameSystem.itemData) {
            itemGrid.innerHTML = '<div>アイテムデータを読み込み中...</div>';
            return;
        }
        
        const allItems = [];
        Object.entries(gameSystem.itemData.items).forEach(([rarity, items]) => {
            items.forEach(item => {
                allItems.push({ name: item, rarity });
            });
        });
        
        const discoveredCount = Object.keys(gameSystem.playerData.discoveredItems).length;
        const totalCount = allItems.length;
        const percentage = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;
        
        completionRate.textContent = `${discoveredCount}/${totalCount} (${percentage}%)`;
        
        itemGrid.innerHTML = '';
        
        allItems.forEach(({ name, rarity }) => {
            const isDiscovered = gameSystem.playerData.discoveredItems[name];
            const count = gameSystem.playerData.inventory[name] || 0;
            
            const card = document.createElement('div');
            card.className = `item-card ${isDiscovered ? 'discovered' : 'unknown'}`;
            card.dataset.rarity = rarity;
            
            if (isDiscovered) {
                card.innerHTML = `
                    <div style="color: ${gameSystem.itemData.rarityColors[rarity]}; font-weight: bold; margin-bottom: 8px;">
                        ✨ ${name}
                    </div>
                    <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">
                        所持数: ${count}個
                    </div>
                    <div style="font-size: 0.8em; color: #999; margin-bottom: 8px;">
                        レアリティ: ${rarity}
                    </div>
                    <div style="font-size: 0.85em; color: #444; line-height: 1.3; font-style: italic;">
                        ${gameSystem.itemData.descriptions[name]}
                    </div>
                `;
                card.style.cssText = 'border: 1px solid #ddd; padding: 12px; border-radius: 8px; background-color: #fafafa;';
            } else {
                card.innerHTML = `
                    <div style="color: #999; font-weight: bold; margin-bottom: 8px;">
                        ❓ ？？？
                    </div>
                    <div style="font-size: 0.9em; color: #ccc; margin-bottom: 5px;">
                        所持数: ?個
                    </div>
                    <div style="font-size: 0.8em; color: #ccc; margin-bottom: 8px;">
                        レアリティ: ${rarity}
                    </div>
                    <div style="font-size: 0.85em; color: #bbb; line-height: 1.3; font-style: italic;">
                        まだ発見していません...
                    </div>
                `;
                card.style.cssText = 'border: 1px dashed #ccc; padding: 12px; border-radius: 8px; background-color: #f9f9f9; opacity: 0.7;';
            }
            
            itemGrid.appendChild(card);
        });
    }
    
    updateStats() {
        const gameSystem = app.gameSystem;
        
        document.getElementById('totalPomodorosStat').textContent = gameSystem.playerData.totalPomodoros;
        document.getElementById('currentLevelStat').textContent = gameSystem.playerData.level;
        document.getElementById('totalItemsStat').textContent = gameSystem.playerData.totalItems;
        
        const floor = Math.floor(gameSystem.playerData.totalPomodoros / 10) + 1;
        document.getElementById('dungeonFloorStat').textContent = `${floor}F`;
        
        const rarityStats = document.getElementById('rarityStats');
        const rarityCount = { common: 0, rare: 0, epic: 0, legendary: 0 };
        
        Object.entries(gameSystem.playerData.inventory).forEach(([item, count]) => {
            const rarity = gameSystem.playerData.discoveredItems[item];
            if (rarity && rarityCount[rarity] !== undefined) {
                rarityCount[rarity] += count;
            }
        });
        
        if (!gameSystem.itemData) {
            rarityStats.innerHTML = '<div>データを読み込み中...</div>';
            return;
        }
        
        rarityStats.innerHTML = Object.entries(rarityCount).map(([rarity, count]) => `
            <div style="border: 1px solid ${gameSystem.itemData.rarityColors[rarity]}; padding: 10px; border-radius: 5px; text-align: center;">
                <div style="font-size: 1.5em; font-weight: bold; color: ${gameSystem.itemData.rarityColors[rarity]};">${count}</div>
                <div style="color: #666; font-size: 0.9em;">${rarity}</div>
            </div>
        `).join('');
    }
}

// ========================================
// モーダル制御
// ========================================
function closeResultModal() {
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('modalBackground').style.display = 'none';
}

// ========================================
// アプリケーション初期化
// ========================================
const app = new PomodoroApp();
const tabSystem = new TabSystem();
