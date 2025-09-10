(function(){
    const UI = {
        logEl: null,
        xpEl: null,
        hpEl: null,
        floorEl: null,
        statsEl: null,
        debug: false,

        init: function() {
            this.logEl = document.getElementById('ui-log') || null;
            this.xpEl = document.getElementById('player-xp') || null;
            this.hpEl = document.getElementById('player-health') || null;
            this.floorEl = document.getElementById('dungeon-floor') || null;
            this.statsEl = document.getElementById('player-stats') || null;

            this.log('UI inicializado.');
            this.updateStats(window.Game?.player); // Inicializa stats
        },

        log: function(msg) {
            if (this.debug) console.log('[UI LOG]', msg);
            console.log(msg);
            if (!this.logEl) return;
            const p = document.createElement('p');
            p.textContent = msg;
            p.style.margin = '4px 0';
            p.style.opacity = '0';
            p.style.transition = 'opacity 0.2s';
            this.logEl.appendChild(p);
            while (this.logEl.children.length > 40) this.logEl.removeChild(this.logEl.firstChild);
            setTimeout(()=> p.style.opacity = '1', 10);
            this.logEl.scrollTop = this.logEl.scrollHeight;
        },

        updateXP: function(xp) {
            if (this.xpEl) this.xpEl.textContent = xp ?? '0';
        },

        updateHP: function(hp, maxHp) {
            if (this.hpEl) this.hpEl.textContent = `${hp ?? '—'}/${maxHp ?? '—'}`;
        },

        updateFloor: function(floor) {
            if (this.floorEl) this.floorEl.textContent = floor ?? '1';
        },

        updateStats: function(player) {
            if (!this.statsEl || !player) return;
            this.statsEl.innerHTML = `
                <div>Vida: ${player.hp ?? '—'}/${player.maxHp ?? '—'}</div>
                <div>Experiência: ${player.xp ?? 0}</div>
                <div>Ataque: ${player.atk ?? '—'}</div>
                <div>Defesa: ${player.def ?? '—'}</div>
                <div>Velocidade: ${player.speed ?? '—'}</div>
                <div>Precisão: ${player.hit ?? '—'}</div>
                <div>Evasão: ${player.eva ?? '—'}</div>
                <div>Chance Crítica: ${player.critChance ?? '—'}%</div>
                <div>Multiplicador Crítico: ${player.critMult ?? '—'}</div>
            `;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ()=> UI.init());
    } else {
        UI.init();
    }

    window.UI = UI;
})();