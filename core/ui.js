(function(){
    const UI = {
        logEl: null,
        xpEl: null,
        hpEl: null,
        floorEl: null,
        statsEl: null,
        miniHpEl: null,
        miniXpEl: null,
        miniFloorEl: null,
        portraitEl: null,
        debug: false,
        _currentModal: null,

        init: function() {
            this.logEl = document.getElementById('ui-log') || null;
            this.xpEl = document.getElementById('player-xp') || null;
            this.hpEl = document.getElementById('player-health') || null;
            this.floorEl = document.getElementById('dungeon-floor') || null;
            this.statsEl = document.getElementById('player-stats') || null;

            this.miniHpEl = document.getElementById('mini-hp') || null;
            this.miniXpEl = document.getElementById('mini-xp') || null;
            this.miniFloorEl = document.getElementById('mini-floor') || null;
            this.portraitEl = document.getElementById('player-portrait') || null;

            if (!document.getElementById('wyrd-modal-overlay')) {
                const ov = document.createElement('div');
                ov.id = 'wyrd-modal-overlay';
                ov.style.position = 'fixed';
                ov.style.left = '0';
                ov.style.top = '0';
                ov.style.width = '100%';
                ov.style.height = '100%';
                ov.style.display = 'none';
                ov.style.alignItems = 'center';
                ov.style.justifyContent = 'center';
                ov.style.zIndex = 999999;
                document.body.appendChild(ov);
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closePopup();
                }
            });

            this.log('UI inicializado.');
            this.updateStats(window.Game?.player); // Inicializa stats
            this.updateMiniHud(window.Game?.player);
        },

        log: function(msg) {
            if (this.debug) console.log('[UI LOG]', msg);
            if (!this.logEl) return;
            const p = document.createElement('p');
            p.textContent = msg;
            this.logEl.appendChild(p);
            // animate in
            requestAnimationFrame(()=> p.classList.add('show'));
            while (this.logEl.children.length > 40) this.logEl.removeChild(this.logEl.firstChild);
            this.logEl.scrollTop = this.logEl.scrollHeight;
            // also console
            console.log(msg);
        },

        updateXP: function(xp) {
            if (this.xpEl) this.xpEl.textContent = xp ?? '0';
            if (this.miniXpEl) this.miniXpEl.textContent = `XP: ${xp ?? 0}`;
        },

        updateHP: function(hp, maxHp) {
            if (this.hpEl) this.hpEl.textContent = `${hp ?? '—'}/${maxHp ?? '—'}`;
            if (this.miniHpEl) this.miniHpEl.textContent = `${hp ?? '—'}/${maxHp ?? '—'}`;
        },

        updateFloor: function(floor) {
            let num = floor;
            if (typeof floor === 'object' && floor?.floorNumber !== undefined) num = floor.floorNumber;
            if (this.floorEl) this.floorEl.textContent = num ?? '1';
            if (this.miniFloorEl) this.miniFloorEl.textContent = `F: ${num ?? 1}`;
        },

        updateStats: function(player) {
            if (!this.statsEl) return;
            const content = document.getElementById('player-stats-content');
            if (content) {
                content.innerHTML = `
                    Vida: ${player?.hp ?? '—'}/${player?.maxHp ?? '—'}<br>
                    Experiência: ${player?.xp ?? 0}<br>
                    Ataque: ${player?.atk ?? '—'}<br>
                    Defesa: ${player?.def ?? '—'}<br>
                    Velocidade: ${player?.speed ?? '—'}<br>
                    Precisão: ${player?.hit ?? '—'}<br>
                    Evasão: ${player?.eva ?? '—'}<br>
                    Chance Crítica: ${player?.critChance ?? '—'}%<br>
                `;
            }
            this.updateMiniHud(player);
        },

        updateMiniHud: function(player) {
            if (!player) return;
            if (this.miniHpEl) this.miniHpEl.textContent = `${player.hp ?? '—'}/${player.maxHp ?? '—'}`;
            if (this.miniXpEl) this.miniXpEl.textContent = `XP: ${player.xp ?? 0}`;
            if (this.miniFloorEl) this.miniFloorEl.textContent = `F: ${window.Game?.floor?.floorNumber ?? window.Game?.floor ?? 1}`;
            if (this.portraitEl && player?.sprite) {
                if (typeof player.sprite === 'string') {
                    this.portraitEl.src = player.sprite;
                } else if (player.sprite instanceof Image && player.sprite.src) {
                    this.portraitEl.src = player.sprite.src;
                }
            }
        },

        _createModalDOM: function() {
            const overlay = document.getElementById('wyrd-modal-overlay');
            if (!overlay) return null;
            overlay.innerHTML = '';
            overlay.style.display = 'flex';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.backdropFilter = 'blur(4px)';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const modal = document.createElement('div');
            modal.className = 'wyrd-modal';
            modal.style.minWidth = '320px';
            modal.style.maxWidth = '720px';
            modal.style.background = 'linear-gradient(180deg,#0f1112,#0b0b0c)';
            modal.style.border = '1px solid rgba(255,255,255,0.04)';
            modal.style.padding = '18px';
            modal.style.borderRadius = '12px';
            modal.style.boxShadow = '0 14px 48px rgba(0,0,0,0.7)';
            modal.style.color = '#e6e6e8';
            modal.style.zIndex = 1000000;
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.gap = '12px';

            const title = document.createElement('div');
            title.className = 'wyrd-modal-title';
            title.style.fontWeight = 700;
            title.style.fontSize = '1.05rem';
            modal.appendChild(title);

            const body = document.createElement('div');
            body.className = 'wyrd-modal-body';
            body.style.fontSize = '0.95rem';
            body.style.lineHeight = '1.4';
            modal.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'wyrd-modal-footer';
            footer.style.display = 'flex';
            footer.style.justifyContent = 'flex-end';
            footer.style.gap = '10px';
            modal.appendChild(footer);

            overlay.appendChild(modal);

            return { overlay, modal, title, body, footer };
        },

        showPopup: function(opts = {}) {
            try {
                this.closePopup(); 
                const dom = this._createModalDOM();
                if (!dom) return;
                this._currentModal = dom;
                dom.title.textContent = opts.title ?? 'WYRD';
                if (typeof opts.message === 'string') dom.body.textContent = opts.message;
                else if (opts.message instanceof HTMLElement) dom.body.appendChild(opts.message);
                else if (opts.message === undefined) dom.body.textContent = '';

                const btns = Array.isArray(opts.buttons) ? opts.buttons : [
                    { text: 'OK', onClick: ()=> this.closePopup() }
                ];
                for (const b of btns) {
                    const el = document.createElement('button');
                    el.textContent = b.text ?? 'OK';
                    el.className = b.className ?? '';
                    el.style.padding = '8px 12px';
                    el.style.borderRadius = '8px';
                    el.style.cursor = 'pointer';
                    el.addEventListener('click', (ev) => {
                        try {
                            if (typeof b.onClick === 'function') b.onClick(ev);
                        } catch(e){ console.warn('modal button error', e); }
                    });
                    dom.footer.appendChild(el);
                }

                // clique fora fecha (opcional)
                if (opts.dismissible !== false) {
                    dom.overlay.addEventListener('click', (e) => {
                        if (e.target === dom.overlay) this.closePopup();
                    }, { once: true });
                }
            } catch (e) {
                console.warn('Erro showPopup', e);
            }
        },

        closePopup: function() {
            const ov = document.getElementById('wyrd-modal-overlay');
            if (!ov) return;
            ov.style.display = 'none';
            ov.innerHTML = '';
            this._currentModal = null;
        },

        showGameOverPopup: function() {
            this.showPopup({
                title: '💀 Você morreu!',
                message: 'Sua jornada terminou por enquanto. Deseja voltar ao menu principal?',
                buttons: [
                    {
                        text: 'Voltar ao Menu',
                        className: 'btn-danger',
                        onClick: () => {
                            // Fecha o jogo e retorna ao menu
                            try {
                                window.Game = window.Game || {};
                                window.Game.running = false;
                            } catch(e) {}
                            const menu = document.getElementById('menu-screen');
                            const game = document.getElementById('game-screen');
                            if (menu) menu.style.display = 'flex';
                            if (game) game.style.display = 'none';
                            this.closePopup();
                        }
                    },
                    {
                        text: 'Cancelar',
                        className: 'btn-cancel',
                        onClick: () => { this.closePopup(); }
                    }
                ],
                dismissible: false
            });
        },

        showStairsPopup: function(onConfirm) {
            this.showPopup({
                title: '🔽 Escada encontrada',
                message: 'Há uma escada que leva ao próximo andar. Deseja descer?',
                buttons: [
                    {
                        text: 'Descer',
                        className: 'btn-primary',
                        onClick: () => {
                            try {
                                if (typeof onConfirm === 'function') onConfirm();
                            } catch(e) { console.warn('Erro onConfirm stairs', e); }
                            this.closePopup();
                        }
                    },
                    {
                        text: 'Cancelar',
                        onClick: () => { this.closePopup(); }
                    }
                ],
                dismissible: false
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ()=> UI.init());
    } else {
        UI.init();
    }

    window.UI = UI;
})();
