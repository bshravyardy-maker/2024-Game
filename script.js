const tilesContainer = document.getElementById('tiles-container');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const gameMessage = document.getElementById('game-message');
const messageText = document.getElementById('message-text');

let grid = [];
let score = 0;
let bestScore = localStorage.getItem('2048-best-score') || 0;
let history = [];
let tileCounter = 0;

let isGameOver = false;
let isWon = false;
let isAnimating = false;

function init() {
    bestScoreEl.textContent = bestScore;
    document.getElementById('new-game-btn').addEventListener('click', () => { if(!isAnimating) restartGame(); });
    document.getElementById('undo-btn').addEventListener('click', () => { if(!isAnimating) undoMove(); });
    document.getElementById('retry-btn').addEventListener('click', () => { if(!isAnimating) restartGame(); });
    document.getElementById('keep-playing-btn').addEventListener('click', () => {
        gameMessage.classList.remove('active', 'win');
    });
    
    setupInput();
    restartGame();
}

function restartGame() {
    grid = Array(4).fill().map(() => Array(4).fill(null));
    score = 0;
    history = [];
    isGameOver = false;
    isWon = false;
    isAnimating = false;
    tileCounter = 0;
    
    gameMessage.classList.remove('active', 'win');
    updateScore();
    tilesContainer.innerHTML = '';
    
    addRandomTile();
    addRandomTile();
}

function saveState() {
    const state = {
        grid: grid.map(row => row.map(cell => cell ? { ...cell } : null)),
        score: score
    };
    history.push(state);
    if(history.length > 20) history.shift();
}

function undoMove() {
    if (history.length === 0 || isGameOver || isAnimating || gameMessage.classList.contains('active')) return;
    
    const lastState = history.pop();
    grid = lastState.grid.map(row => row.map(cell => cell ? { ...cell } : null)); 
    score = lastState.score;
    
    // Check if after undoing, we no longer meet win conditions
    let maxValue = 0;
    for(let r=0; r<4; r++) {
        for(let c=0; c<4; c++) {
            if(grid[r][c] && grid[r][c].value > maxValue) maxValue = grid[r][c].value;
        }
    }
    if (maxValue < 2048) {
        isWon = false;
    }

    updateScore();
    renderGrid();
}

function addRandomTile() {
    const emptyCells = [];
    for(let r=0; r<4; r++) {
        for(let c=0; c<4; c++) {
            if(!grid[r][c]) emptyCells.push({r, c});
        }
    }
    
    if (emptyCells.length === 0) return;
    
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    
    const newTile = {
        id: `tile-${tileCounter++}`,
        value: value,
        isNew: true,
        isMerged: false,
        r: randomCell.r,
        c: randomCell.c,
        mergedFrom: []
    };
    
    grid[randomCell.r][randomCell.c] = newTile;
    renderGrid();
}

function getPixelPosition(r, c) {
    return `translate(calc(${c} * (var(--cell-size) + var(--grid-gap)) + var(--grid-gap)), calc(${r} * (var(--cell-size) + var(--grid-gap)) + var(--grid-gap)))`;
}

function renderGrid() {
    const existingTiles = Array.from(tilesContainer.children);
    const existingMap = new Map();
    existingTiles.forEach(t => existingMap.set(t.id, t));

    const renderedIds = new Set();

    grid.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell) {
                // Render old merging tiles for animation context
                if (cell.mergedFrom && cell.mergedFrom.length > 0) {
                    cell.mergedFrom.forEach(prevTile => {
                        updateOrCreateTile(prevTile, r, c, existingMap);
                        renderedIds.add(prevTile.id);
                    });
                    // Clear so next frame they are removed safely
                    cell.mergedFrom = []; 
                }
                
                updateOrCreateTile(cell, r, c, existingMap);
                renderedIds.add(cell.id);
            }
        });
    });

    existingTiles.forEach(t => {
        if (!renderedIds.has(t.id)) {
            t.remove();
        }
    });
}

function updateOrCreateTile(tileData, r, c, existingMap) {
    let tile = existingMap.get(tileData.id);
    let valClass = tileData.value > 2048 ? 'super' : tileData.value;

    if (!tile) {
        tile = document.createElement('div');
        tile.id = tileData.id;
        tile.className = `tile tile-${valClass}`;
        
        if (tileData.isNew) {
            tile.classList.add('tile-new');
            tileData.isNew = false;
        }
        if (tileData.isMerged) {
            tile.classList.add('tile-merged');
            tileData.isMerged = false;
        }
        
        tilesContainer.appendChild(tile);
    } else {
        // Just enforce identity over old classes
        tile.className = `tile tile-${valClass}`;
    }
    
    tile.textContent = tileData.value;
    tile.style.transform = getPixelPosition(r, c);
}

function slide(row) {
    const withoutNulls = row.filter(val => val !== null);
    
    for (let i = 0; i < withoutNulls.length - 1; i++) {
        if (withoutNulls[i].value === withoutNulls[i+1].value) {
            const mergedVal = withoutNulls[i].value * 2;
            const newTile = {
                id: `tile-${tileCounter++}`,
                value: mergedVal,
                isMerged: true,
                mergedFrom: [withoutNulls[i], withoutNulls[i+1]]
            };
            withoutNulls[i] = newTile;
            withoutNulls[i+1] = null;
            score += mergedVal;
        }
    }
    
    const parsed = withoutNulls.filter(val => val !== null);
    while (parsed.length < 4) {
        parsed.push(null);
    }
    return parsed;
}

function transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function move(direction) {
    if (isGameOver || isAnimating || gameMessage.classList.contains('active')) return;

    let hasChanged = false;
    const oldGridStr = JSON.stringify(grid.map(row => row.map(c => c ? c.value : null)));
    saveState();

    let workGrid = grid.map(row => [...row]);

    if (direction === 'Up' || direction === 'Down') workGrid = transpose(workGrid);

    workGrid = workGrid.map(row => {
        let sortedRow = [...row];
        if (direction === 'Right' || direction === 'Down') sortedRow.reverse();
        
        let newRow = slide(sortedRow);
        
        if (direction === 'Right' || direction === 'Down') newRow.reverse();
        return newRow;
    });

    if (direction === 'Up' || direction === 'Down') workGrid = transpose(workGrid);
    
    const newGridStr = JSON.stringify(workGrid.map(row => row.map(c => c ? c.value : null)));
    if (oldGridStr !== newGridStr) {
        hasChanged = true;
        isAnimating = true;
        grid = workGrid;
        
        // Finalize coordinate state
        grid.forEach((row, r) => {
            row.forEach((cell, c) => {
                if(cell) { cell.r = r; cell.c = c; }
            });
        });
        
        updateScore();
        renderGrid(); 
        
        setTimeout(() => {
            addRandomTile();
            checkGameState();
            isAnimating = false;
        }, 120);
    } else {
        history.pop();
    }
}

function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('2048-best-score', bestScore);
    }
    bestScoreEl.textContent = bestScore;
}

function checkGameState() {
    // Win
    if (!isWon) {
        for (let r=0; r<4; r++) {
            for (let c=0; c<4; c++) {
                if (grid[r][c] && grid[r][c].value === 2048) {
                    isWon = true;
                    showEndMenu('You Win!', 'win');
                    return;
                }
            }
        }
    }
    
    // Lose
    let canMove = false;
    for (let r=0; r<4; r++) {
        for (let c=0; c<4; c++) {
            if (!grid[r][c]) {
                canMove = true;
            } else {
                if (r < 3 && grid[r+1][c] && grid[r][c].value === grid[r+1][c].value) canMove = true;
                if (c < 3 && grid[r][c+1] && grid[r][c].value === grid[r][c+1].value) canMove = true;
            }
        }
    }
    
    if (!canMove) {
        isGameOver = true;
        showEndMenu('Game Over!', 'lose');
    }
}

function showEndMenu(msg, type) {
    messageText.textContent = msg;
    if(type === 'win') gameMessage.classList.add('win');
    else gameMessage.classList.remove('win');
    gameMessage.classList.add('active');
}

function setupInput() {
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') move('Up');
        else if (e.key === 'ArrowDown') move('Down');
        else if (e.key === 'ArrowLeft') move('Left');
        else if (e.key === 'ArrowRight') move('Right');
        
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    const gameBoard = document.querySelector('.game-container');

    gameBoard.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }, {passive: false});

    gameBoard.addEventListener('touchend', e => {
        if(isGameOver || gameMessage.classList.contains('active')) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) > 30) {
            if (absDx > absDy) {
                if (dx > 0) move('Right');
                else move('Left');
            } else {
                if (dy > 0) move('Down');
                else move('Up');
            }
        }
    }, {passive: false});
}

init();
