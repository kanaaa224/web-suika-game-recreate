/*
    (c) 2023 kanaaa224. All rights reserved.
*/

import * as utils from 'https://cdn.jsdelivr.net/gh/kanaaa224/web-common@master/web-app-sources/utils.js';

const { $, create } = utils.dom; utils.dom.extend();

import matterJs from 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm';

export default class App {

    constructor() {
        this.initialize();
    }

    async initialize() {
        let manifest = $('link[rel="manifest"]');

        const response = await fetch(manifest.href);
        const data     = await response.json();

        manifest = data;

        const link = create('link');

        link.rel  = 'icon';
        link.href = new URL(manifest.icons[0].src, response.url).href;

        document.head.appendChild(link);

        const title = document.title = manifest.name;

        await $('body').setHTMLWithFade(`
            <main></main>
            <header>
                <h1>${title}</h1>
                <div>
                    <p>
                        <a href="https://github.com/kanaaa224/web-merge-puzzle-game#readme" target="_blank">
                            <span class="mdi mdi-github"></span>
                        </a>
                    </p>
                    <p>
                        <a id="settings">
                            <span class="mdi mdi-cog"></span>
                        </a>
                    </p>
                </div>
            </header>
            <footer>
                <p>© 2023 <a href="https://kanaaa224.github.io" target="_blank">kanaaa224</a>. All rights reserved.</p>
            </footer>
        `);

        $('header a#settings').on('click', e => this.dialogSettingsOpen());

        this.settings = { bgm: false, se: false };

        if(!this.assets) {
            this.loading = true;

            await this.mainLoading();

            const assets = { images: {}, audio: {} };

            const add = (target, files, ext) => {
                for(const file of files) target[file.replaceAll('-', '_')] = `./res/${file}.${ext}`;
            };

            add(assets.images, [ 'icon', 'pop',       ...Array.from({ length: 11 }, (_, i) => `circle-${i}`) ], 'png');
            add(assets.audio,  [ 'bgm-0', 'se-click', ...Array.from({ length: 11 }, (_, i) => `se-pop-${i}`) ], 'mp3');

            await this.preloadAssets(assets);

            this.loading = false;
        }

        await this.dialogAudioConfirmOpen();
        await this.mainTitle();
    }

    async preloadAssets(assets = this.assets) {
        for(const src of Object.values(assets.images)) {
            await new Promise(resolve => {
                const image = new Image();

                image.onload = resolve;
                image.src    = src;
            });
        }

        for(const src of Object.values(assets.audio)) {
            await new Promise(resolve => {
                const audio = new Audio();

                audio.oncanplaythrough = resolve;
                audio.src              = src;
                audio.load();
            });
        }

        this.assets = assets;
    }

    applySettings(settings = this.settings) {
        if(this.loading) return window.alert('現在、読み込み処理中のため変更できません');

        this.settings = settings;

        if(!this.bgm) this.bgm = new Audio(this.assets.audio.bgm_0);
        if(!this.se)  this.se  = new Audio(this.assets.audio.se_click);

        if(this.settings.bgm) {
            this.bgm.loop = true;
            this.bgm.play();
        } else {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }

        $('body').on('click', e => {
            if(this.settings.se) this.se.play();
        });
    }

    async mainLoading() {
        await $('main').setHTMLWithFade(`
            <article class="loading">
                <section>
                    <span class="mdi mdi-loading mdi-spin"></span>読み込み中...
                </section>
            </article>
        `);
    }

    async mainTitle() {
        const circles = [ 'チェリー', 'いちごミルク', 'ぶどう', 'キウイ', 'みかん', 'りんご', '梨', '桃', 'パイナップル', 'メロン', 'スイカ' ];

        const html = circles.map((circle, i) => `
            <div>
                <img src="${this.assets.images[`circle_${i}`]}">
                <div>
                    <h1>${circle}</h1>
                    <p>レベル ${i + 1}</p>
                </div>
            </div>
        `).join('');

        await $('main').setHTMLWithFade(`
            <article class="title">
                <section class="A">
                    <div>
                        <img src="${this.assets.images.icon}">
                        <div>
                            <h1>${document.title}</h1>
                            <p>フルーツを合体させて、高スコアを目指そう！</p>
                        </div>
                    </div>
                </section>
                <section class="B">
                    <p id="play">プレイ</p>
                    <p id="ranking">ランキング</p>
                </section>
                <section class="C">
                    <h1>フルーツ一覧</h1>
                    <div>${html}</div>
                </section>
            </article>
        `);

        $('main p#play')   .on('click', e => this.mainGame());
        $('main p#ranking').on('click', e => window.alert('この機能は開発中です'));
    }

    async mainGame() {
        const highScore = utils.storage.get('high_score') || 0;

        await $('main').setHTMLWithFade(`
            <article class="game">
                <section>
                    <div>
                        <div>
                            <h1>スコア: <span id="score">0</span></h1>
                            <h2>ハイスコア: ${highScore}</h2>
                        </div>
                        <p id="back">タイトルへ</p>
                    </div>
                    <canvas id="game"></canvas>
                </section>
            </article>
        `);

        $('main p#back').on('click', e => {
            const confirm = window.confirm('タイトルへ戻りますか？現在の進捗は消えてしまいます。');

            if(confirm) this.mainTitle();
        });

        const canvas = $('canvas#game');
        const ctx    = canvas.getContext('2d');
        const rect   = canvas.getBoundingClientRect();
        const width  = rect.width;
        const height = rect.height;
        const dpr    = window.devicePixelRatio || 1;

        canvas.width        = width  * dpr;
        canvas.height       = height * dpr;
        canvas.style.width  = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.scale(dpr, dpr);

        const engine = matterJs.Engine.create();

        engine.gravity.y = .6;

        const world = engine.world;

        const sizes = [ 18, 25, 34, 45, 58, 72, 90, 110, 135, 160, 190 ];

        if(window.innerWidth < 1000) sizes.forEach((size, i) => sizes[i] = size / 2);

        const images = await Promise.all(
            sizes.map((_, i) =>
                new Promise(resolve => {
                    const image = new Image();

                    image.src    = this.assets.images[`circle_${i}`];
                    image.onload = () => resolve(image);
                })
            )
        );

        images.pop     = new Image();
        images.pop.src = this.assets.images['pop'];

        const sePop = sizes.map((_, i) => new Audio(this.assets.audio[`se_pop_${i}`]));

        let score   = 0;
        let current = Math.floor(Math.random() * 5);
        let next    = Math.floor(Math.random() * 5);

        let   cursorX = width / 2;
        const cursorY = 50;

        const createCircle = (x, y, level) => {
            const radius = sizes[level];
            const body   = matterJs.Bodies.circle(x, y, radius, { circleLevel: level, restitution: .25, friction: .8 });

            matterJs.World.add(world, body);

            return body;
        };

        const wallSize = 10;

        const walls = [
            { x: width            / 2, y: height - wallSize / 2, w: width,    h: wallSize },
            { x:         wallSize / 2, y: height            / 2, w: wallSize, h: height   },
            { x: width - wallSize / 2, y: height            / 2, w: wallSize, h: height   }
        ];

        matterJs.World.add(world, walls.map(w => matterJs.Bodies.rectangle(w.x, w.y, w.w, w.h, { isStatic: true })));

        const drop = () => {
            createCircle(cursorX, cursorY, current);

            current = next;
            next    = Math.floor(Math.random() * 5);
        };

        const move = x => {
            cursorX = Math.max(20, Math.min(width - 20, cursorX + x));
        };

        window.onkeydown = e => {
            if(e.code === 'ArrowLeft')  move(-50);
            if(e.code === 'ArrowRight') move( 50);
            if(e.code !== 'Space')      return;

            e.preventDefault();

            drop();
        };

        canvas.onclick = () => drop();

        canvas.onpointermove = e => {
            const r = canvas.getBoundingClientRect();

            move(e.clientX - r.left - cursorX);
        };

        matterJs.Events.on(engine, 'collisionStart', e => {
            for(const pair of e.pairs) {
                const a = pair.bodyA;
                const b = pair.bodyB;

                if(
                    a.circleLevel === undefined ||
                    b.circleLevel === undefined ||
                    a.circleLevel !== b.circleLevel ||
                    a.merged ||
                    b.merged
                ) continue;

                const level = a.circleLevel;

                if(level >= sizes.length - 1) continue;

                a.merged = true;
                b.merged = true;

                matterJs.World.remove(world, a);
                matterJs.World.remove(world, b);

                createCircle(
                    (a.position.x + b.position.x) / 2,
                    (a.position.y + b.position.y) / 2,
                    level + 1
                );

                world.pop = {
                    x: (a.position.x + b.position.x) / 2,
                    y: (a.position.y + b.position.y) / 2,
                    frame: 15
                };

                score += (level + 1) * 10;

                $('span#score').textContent = score;

                if(this.settings.se) {
                    sePop[level + 1].currentTime = 0;
                    sePop[level + 1].play();
                }
            }
        });

        const loop = () => {
            if($('dialog#result')) return;

            if(!canvas.isConnected) return;

            matterJs.Engine.update(engine, 1000 / 60);

            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = '#00000055';
            ctx.lineWidth   = 1;

            // for(const w of walls) ctx.strokeRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);

            for(const body of world.bodies) {
                if(body.circleRadius) {
                    /* ctx.beginPath();

                    ctx.arc(
                        body.position.x,
                        body.position.y,
                        body.circleRadius,

                        0, Math.PI * 2
                    );

                    ctx.stroke(); */

                    ctx.drawImage(
                        images[body.circleLevel],

                        body.position.x - body.circleRadius,
                        body.position.y - body.circleRadius,

                        body.circleRadius * 2,
                        body.circleRadius * 2
                    );

                    if(body.position.y < -50) {
                        if(score > highScore) utils.storage.set({ 'high_score': score });

                        this.dialogResultOpen(score, highScore);
                    }
                }
            }

            ctx.fillStyle = '#ffffff1a';

            ctx.beginPath();

            ctx.arc(
                cursorX,
                cursorY,

                75, 0, Math.PI * 2
            );

            ctx.fill();

            ctx.drawImage(
                images[current],

                cursorX - sizes[current],
                cursorY - sizes[current],

                sizes[current] * 2,
                sizes[current] * 2
            );

            ctx.beginPath();

            ctx.arc(
                cursorX + 87.5,
                cursorY - 12.5,

                25, 0, Math.PI * 2
            );

            ctx.fill();

            ctx.drawImage(
                images[next],

                cursorX + 75,
                cursorY - 25,

                25, 25
            );

            if(world.pop) {
                ctx.globalAlpha = world.pop.frame / 15;

                ctx.drawImage(
                    images.pop,

                    world.pop.x - 32,
                    world.pop.y - 32,

                    64, 64
                );

                ctx.globalAlpha = 1;

                if(--world.pop.frame <= 0) delete world.pop;
            }

            requestAnimationFrame(loop);
        };

        loop();
    }

    async dialogSettingsOpen() {
        if($('dialog#settings')) return;

        let dialog = null;

        $('body').add(dialog = create('dialog', { id: 'settings' }));

        await dialog.setHTMLWithFade(`
            <div>
                <h1>設定</h1>
                <div style="gap: 1rem; display: inherit;">
                    <div style="gap: .5rem; display: inherit; flex-direction: column;">
                        <p>BGM</p>
                        <p>SE</p>
                        <p>テーマ</p>
                        <p>セーブデータ</p>
                    </div>
                    <div style="gap: .5rem; display: inherit; flex-direction: column;">
                        <p class="button" id="bgm">${this.settings.bgm ? 'オン' : 'オフ'}</p>
                        <p class="button" id="se">${this.settings.se  ? 'オン' : 'オフ'}</p>
                        <p class="button" id="theme">デフォルト</p>
                        <p class="button" id="reset">リセット</p>
                    </div>
                </div>
            </div>
        `);

        dialog.on('click', e => { if(e.target === dialog) this.dialogSettingsClose(); });

        $('p#bgm',   dialog).on('click', e => { this.applySettings({ ...this.settings, bgm: !this.settings.bgm }); e.target.textContent = this.settings.bgm ? 'オン' : 'オフ'; });
        $('p#se',    dialog).on('click', e => { this.applySettings({ ...this.settings, se:  !this.settings.se  }); e.target.textContent = this.settings.se  ? 'オン' : 'オフ'; });
        $('p#theme', dialog).on('click', e => { window.alert('この機能は開発中です'); });
        $('p#reset', dialog).on('click', e => { const confirm = window.confirm('セーブデータを消去してリセットしますか？'); if(confirm) { utils.storage.remove(); window.alert('リセットしました。再起動します。'); location.reload(); } });
    }

    async dialogSettingsClose() {
        await $('dialog#settings').setHTMLWithFade('');

        $('dialog#settings').remove();
    }

    async dialogAudioConfirmOpen() {
        if($('dialog#confirm')) return;

        let dialog = null;

        $('body').add(dialog = create('dialog', { id: 'confirm' }));

        await dialog.setHTMLWithFade(`
            <div>
                <h1 style="text-align: center;">
                    <span class="mdi mdi-music"></span>
                </h1>
                <p>
                    このゲームでは音が流れます。<br>
                    サウンド再生をオンにしますか？
                </p>
                <div style="gap: 1rem; display: inherit; justify-content: center;">
                    <p class="button" id="off">オフ</p>
                    <p class="button" id="on">オン</p>
                </div>
            </div>
        `);

        dialog.on('click', e => { if(e.target === dialog) this.dialogAudioConfirmClose(); });

        $('p#off', dialog).on('click', e => { this.dialogAudioConfirmClose(); });
        $('p#on',  dialog).on('click', e => { this.dialogAudioConfirmClose(); this.applySettings({ bgm: true, se: true }); });
    }

    async dialogAudioConfirmClose() {
        await $('dialog#confirm').setHTMLWithFade('');

        $('dialog#confirm').remove();
    }

    async dialogResultOpen(score, highScore) {
        if($('dialog#result')) return;

        let dialog = null;

        $('body').add(dialog = create('dialog', { id: 'result' }));

        await dialog.setHTMLWithFade(`
            <div>
                <h1 style="text-align: center;">ゲームオーバー</h1>
                <p style="text-align: center;">
                    スコア: ${score}
                    ${score > highScore ? '<br>ハイスコアを更新！' : ''}
                </p>
                <div style="gap: 1rem; display: inherit; justify-content: center;">
                    <p class="button" id="close">閉じる</p>
                </div>
            </div>
        `);

        dialog.on('click', e => { if(e.target === dialog) this.dialogResultClose(); });

        $('p#close', dialog).on('click', e => { this.dialogResultClose(); });
    }

    async dialogResultClose() {
        await $('dialog#result').setHTMLWithFade('');

        $('dialog#result').remove();

        await this.mainTitle();
    }

}