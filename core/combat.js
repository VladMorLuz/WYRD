(function(){
    const CONF = {
        turnThreshold: 100,
        speedScale: 20,
        tickPausedWhileMenu: true
    };

    const State = {
        active: false,
        player: null,
        enemy: null,
        room: null,
        awaitingPlayerAction: false,
        lastTick: 0
    };

    const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

    function log(msg){
        if (window.UI && typeof window.UI.log === 'function') window.UI.log(msg);
        else console.log('[Combat]', msg);
    }

    function removeEntityFromRoom(entity) {
        try {
            if (!entity) return;
            if (State.room?.metadata?.entities) {
                const arr = State.room.metadata.entities;
                const idx = arr.indexOf(entity);
                if (idx !== -1) arr.splice(idx, 1);
            }
            if (window.Game?.entities) {
                const gidx = window.Game.entities.indexOf(entity);
                if (gidx !== -1) window.Game.entities.splice(gidx, 1);
            }
        } catch (e) { console.warn('removeEntityFromRoom erro', e); }
    }

    function performAttack(attacker, defender) {
        if (!attacker || !defender) return;
        if (!defender.alive || !attacker.alive) return;
        if (typeof window.resolveAttack === 'function') {
            window.resolveAttack(attacker, defender);
        } else {
            const dmg = Math.max(0, (attacker.atk||1) - (defender.def||0));
            defender.hp -= dmg;
            log(`${attacker.char} causou ${dmg} em ${defender.char}`);
            if (defender.hp <= 0) {
                defender.alive = false;
                log(`${defender.char} morreu.`);
            }
        }
        window.UI?.updateStats?.(window.Game?.player); // Atualizar stats após ataque
    }

    function endCombat(reason) {
        if (!State.active) return;
        State.active = false;
        State.awaitingPlayerAction = false;

        if (State.enemy && !State.enemy.alive) {
            log(`💀 ${State.enemy.char} derrotado! (+${State.enemy.xpReward || 0} XP)`);
            if (State.player && typeof State.player.gainXP === 'function') {
                State.player.gainXP(State.enemy.xpReward || 0);
            } else if (State.player) {
                State.player.xp = (State.player.xp || 0) + (State.enemy.xpReward || 0);
                if (window.UI?.updateXP) window.UI.updateXP(State.player.xp);
            }
            removeEntityFromRoom(State.enemy);
        }

        if (State.player && !State.player.alive) {
            log('💀 Você morreu! Fim de jogo.');
            window.Game = window.Game || {};
            window.Game.running = false;
            setTimeout(()=>{
                const menu = document.getElementById('menu-screen');
                const game = document.getElementById('game-screen');
                if (menu) menu.style.display = 'flex';
                if (game) game.style.display = 'none';
                log('Retornando ao menu...');
            }, 800);
        }

        try {
            const room = State.room;
            const entities = (window.Game?.entities || []).filter(e => e.alive);
            window.Renderer?.drawRoom?.(room, State.player || window.Game?.player, entities);
        } catch(e){ console.warn('Erro redraw after combat:', e); }

        if (window.UI) {
            window.UI.updateHP?.(State.player?.hp, State.player?.maxHp);
            window.UI.updateXP?.(State.player?.xp);
            window.UI.updateFloor?.(window.Game?.floor?.floorNumber);
            window.UI.updateStats?.(State.player || window.Game?.player); // Atualizar stats no fim do combate
        }

        if (window.Game?.Input) {
            window.Game.Input.up = false;
            window.Game.Input.down = false;
            window.Game.Input.left = false;
            window.Game.Input.right = false;
            window.Game.Input.interact = false;
        }

        State.player = null;
        State.enemy = null;
        State.room = null;
        State.lastTick = 0;
        hidePlayerMenu();

        if (reason) log('Combat end: ' + reason);
    }

    function enemyAct() {
        if (!State.enemy || !State.player) return;
        State.enemy.isDefending = false;

        const lowHp = (State.enemy.hp / State.enemy.maxHp) < 0.25;
        if (lowHp && Math.random() < 0.35) {
            const chance = clamp(30 + (State.enemy.speed ?? State.enemy.turnSPD ?? 0), 5, 95);
            if (Math.random()*100 < chance) {
                log(`${State.enemy.char} fugiu!`);
                removeEntityFromRoom(State.enemy);
                endCombat('enemy fled');
                return;
            }
        }

        if (Math.random() < 0.15) {
            State.enemy.isDefending = true;
            log(`${State.enemy.char} está defendendo!`);
        } else {
            performAttack(State.enemy, State.player);
            if (!State.player.alive) { endCombat('player died'); return; }
        }

        State.enemy.turnMeter = 0;
    }

    function playerAttack() {
        if (!State.active || !State.player || !State.enemy) return;
        State.player.isDefending = false;
        performAttack(State.player, State.enemy);
        if (!State.enemy.alive) { hidePlayerMenu(); endCombat('enemy died'); return; }
        State.player.turnMeter = 0;
        hidePlayerMenu();
    }

    function playerDefend() {
        if (!State.active || !State.player) return;
        State.player.isDefending = true;
        State.player.turnMeter = 0;
        hidePlayerMenu();
        log('🛡️ Você está defendendo (diminui dano até seu próximo turno).');
    }

    function playerItem() {
        log('🧪 Usou item (placeholder).');
        State.player.turnMeter = 0;
        hidePlayerMenu();
    }

    function playerSkill() {
        log('✨ Usou habilidade (placeholder).');
        State.player.turnMeter = 0;
        hidePlayerMenu();
    }

    function playerFlee() {
        if (!State.active || !State.player) return;
        const speed = State.player.speed ?? State.player.turnSPD ?? 0;
        const chance = clamp(50 + speed, 5, 95);
        if (Math.random()*100 < chance) {
            log('🏃 Você fugiu com sucesso!');
            hidePlayerMenu();
            endCombat('player fled');
            return;
        } else {
            log('😓 Fuga falhou! Inimigo age imediatamente!');
            hidePlayerMenu();
            performAttack(State.enemy, State.player);
            if (!State.player.alive) { endCombat('player died'); return; }
            State.player.turnMeter = 0;
        }
    }

    function ensureCombatMenu() {
    let menu = document.getElementById('combat-menu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'combat-menu';
    menu.style.position = 'absolute';
    menu.style.left = '12px';
    menu.style.bottom = '80px'; // antes era 12px → sobe um pouco o menu
    menu.style.padding = '10px';
    menu.style.background = '#111c';
    menu.style.border = '1px solid #555';
    menu.style.borderRadius = '6px';
    menu.style.display = 'none';
    menu.style.zIndex = 9999;
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '6px';
    menu.style.minWidth = '120px';
    menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';

    const btns = [
        { id: 'atk', text: '⚔️ ATACAR', fn: playerAttack },
        { id: 'def', text: '🛡️ DEFENDER', fn: playerDefend },
        { id: 'item', text: '🧪 ITEM', fn: playerItem },
        { id: 'skill', text: '✨ HABILIDADE', fn: playerSkill },
        { id: 'flee', text: '🏃 FUGIR', fn: playerFlee }
    ];
    for (const b of btns) {
        const el = document.createElement('button');
        el.id = 'combat-btn-' + b.id;
        el.textContent = b.text;
        el.style.padding = '8px 12px';
        el.style.background = '#222';
        el.style.color = '#eee';
        el.style.border = '1px solid #444';
        el.style.borderRadius = '4px';
        el.style.cursor = 'pointer';
        el.style.fontFamily = 'monospace';
        el.style.fontSize = '14px';
        el.addEventListener('mouseenter', () => {
            el.style.background = '#333';
        });
        el.addEventListener('mouseleave', () => {
            el.style.background = '#222';
        });
        el.addEventListener('click', () => { b.fn(); });
        menu.appendChild(el);
    }
    document.body.appendChild(menu);
    return menu;
}


    function showPlayerMenu() {
        const menu = ensureCombatMenu();
        menu.style.display = 'grid';
        State.awaitingPlayerAction = true;
    }

    function hidePlayerMenu() {
        const menu = document.getElementById('combat-menu');
        if (menu) menu.style.display = 'none';
        State.awaitingPlayerAction = false;
    }

    function renderCombat() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = '#0b0b0f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, h*0.48, w, h*0.04);

    // posições
    const px = w * 0.25, py = h * 0.75;
    const ex = w * 0.75, ey = h * 0.25;

    if (State.player?.sprite instanceof Image && State.player.sprite.complete) {
        try {
            ctx.drawImage(State.player.sprite, px - 24, py - 24, 48, 48);
        } catch (e) {
            // fallback visual caso drawImage falhe
            ctx.fillStyle = State.player?.color || '#38bdf8';
            ctx.fillRect(px - 24, py - 24, 48, 48);
            ctx.fillStyle = '#fff';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(State.player?.char || '@', px, py);
        }
    } else {
        ctx.fillStyle = State.player?.color || '#38bdf8';
        ctx.fillRect(px - 24, py - 24, 48, 48);
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(State.player?.char || '@', px, py);
    }

    if (State.enemy?.sprite instanceof Image && State.enemy.sprite.complete) {
        try {
            ctx.drawImage(State.enemy.sprite, ex - 24, ey - 24, 48, 48);
        } catch (e) {
            ctx.fillStyle = State.enemy?.color || '#f97316';
            ctx.fillRect(ex - 24, ey - 24, 48, 48);
            ctx.fillStyle = '#fff';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(State.enemy?.char || 'M', ex, ey);
        }
    } else {
        ctx.fillStyle = State.enemy?.color || '#f97316';
        ctx.fillRect(ex - 24, ey - 24, 48, 48);
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(State.enemy?.char || 'M', ex, ey);
    }

    drawBar(ctx, px, py - 36, clamp((State.player?.hp || 0) / (State.player?.maxHp || 1), 0, 1), '#ef4444');
    drawBar(ctx, ex, ey + 36, clamp((State.enemy?.hp || 0) / (State.enemy?.maxHp || 1), 0, 1), '#ef4444');

    drawBar(ctx, px, py - 56, clamp((State.player?.turnMeter || 0) / CONF.turnThreshold, 0, 1), '#3b82f6', true);
    drawBar(ctx, ex, ey + 56, clamp((State.enemy?.turnMeter || 0) / CONF.turnThreshold, 0, 1), '#3b82f6', true);

    ctx.restore();
}

    function drawBar(ctx, x, y, pct, color, isAtb = false) {
        const barW = 120, barH = 8;
        ctx.fillStyle = '#0008';
        ctx.fillRect(x - barW/2, y, barW, barH);
        ctx.fillStyle = color;
        ctx.fillRect(x - barW/2, y, barW * pct, barH);
        if (isAtb) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText('TURN', x - barW/2 + 18, y + 7);
        }
    }

    function combatTick(now) {
        if (!State.active) return;
        if (!State.lastTick) State.lastTick = now;
        const dt = (now - State.lastTick) / 1000;
        State.lastTick = now;

        if (!State.awaitingPlayerAction || !CONF.tickPausedWhileMenu) {
            const pSpeed = (State.player?.speed ?? State.player?.turnSPD ?? 10);
            const eSpeed = (State.enemy?.speed ?? State.enemy?.turnSPD ?? 8);
            State.player.turnMeter = (State.player.turnMeter || 0) + (pSpeed * dt * CONF.speedScale);
            State.enemy.turnMeter = (State.enemy.turnMeter || 0) + (eSpeed * dt * CONF.speedScale);
        }

        State.player.turnMeter = clamp(State.player.turnMeter || 0, 0, 1000);
        State.enemy.turnMeter = clamp(State.enemy.turnMeter || 0, 0, 1000);

        const ready = [];
        if ((State.player.turnMeter || 0) >= CONF.turnThreshold) ready.push({ who: 'player', meter: State.player.turnMeter });
        if ((State.enemy.turnMeter || 0) >= CONF.turnThreshold) ready.push({ who: 'enemy', meter: State.enemy.turnMeter });
        ready.sort((a,b) => b.meter - a.meter);

        for (const r of ready) {
            if (!State.active) break;
            if (r.who === 'player') {
                if (State.awaitingPlayerAction) break;
                showPlayerMenu();
                break;
            } else {
                enemyAct();
                if (!State.active) break;
            }
        }

        renderCombat();

        if (State.active) requestAnimationFrame(combatTick);
    }

    function start(player, enemy, room) {
        if (!player || !enemy || !room) {
            console.warn('Combat.start inválido — requisitos: player, enemy, room');
            return;
        }
        if (State.active) {
            console.warn('Combat já ativo — ignorando novo start');
            return;
        }

        State.active = true;
        State.player = player;
        State.enemy = enemy;
        try {
            if (!State.player.id) State.player.id = "player";

     function forceBattleSprite(entity, id) {
        if (!id) return;
        const path = `assets/battle/${id}.png`;
        const img = new Image();
        img.onload = function() {
            entity.sprite = img;
            console.log(`[Combat] sprite (battle) carregado: ${path}`);
        };
        img.onerror = function() {
            console.warn(`[Combat] não achou sprite battle em: ${path}`);
        };
        img.src = path;
        }

        if (State.player?.id) forceBattleSprite(State.player, State.player.id);
        if (State.enemy?.id)  forceBattleSprite(State.enemy,  State.enemy.id);

     } catch(e) {
        console.warn('forceBattleSprite falhou:', e);
    }
        State.room = room;
        try {
     if (typeof tryAutoLoadSprite === 'function') {
        if (State.player?.id) tryAutoLoadSprite(State.player, State.player.id);
        if (State.enemy?.id)  tryAutoLoadSprite(State.enemy,  State.enemy.id);
    }
} catch(e) {
    console.warn('sprite reload falhou:', e);
}
        State.awaitingPlayerAction = false;
        State.lastTick = 0;

        player.turnMeter = player.turnMeter ?? 0;
        enemy.turnMeter = enemy.turnMeter ?? 0;
        player.speed = player.speed ?? player.turnSPD ?? 10;
        enemy.speed = enemy.speed ?? enemy.turnSPD ?? (enemy.isBoss ? 14 : 8);

        log(`⚔️ Combate iniciado: ${player.char} vs ${player.trait} (${enemy.trait})`);
        requestAnimationFrame(combatTick);
    }

    function handleInput(e) {
        if (!State.active) return;
        const key = (e.key || '').toLowerCase();
        if (!State.awaitingPlayerAction) return;
        if (key === 'a') playerAttack();
        else if (key === 'd') playerDefend();
        else if (key === 'f') playerFlee();
        else if (key === '1') playerItem();
        else if (key === '2') playerSkill();
    }


    

    window.Combat = {
        start,
        end: endCombat,
        isActive: () => !!State.active,
        handleInput
    };

    document.addEventListener('keydown', (e) => {
        if (window.Combat?.isActive?.()) {
            handleInput(e);
        }
    });

    console.log('Combat (novo ATB) carregado.');
})();