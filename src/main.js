class Modal {
    constructor() {
        window.addEventListener('load', () => {
            if(document.querySelector('.modals')) document.querySelector('.modals').remove();

            document.body.innerHTML += `<div class="modals"></div>`;
        });
    }

    render(setData = {}) {
        setData.id      = setData.id      ? setData.id      : 'modal';
        setData.content = setData.content ? setData.content : '';

        if(!document.querySelector('.modals')) return false;
        if(document.querySelector(`#${setData.id}`)) return false;

        document.querySelector('.modals').innerHTML += `<div class="modal" id="${setData.id}"><div class="container">${setData.content}</div></div>`;

        return true;
    }

    destroy(setData = {}) {
        setData.id = setData.id ? setData.id : 'modal';

        if(!document.querySelector(`#${setData.id}`)) return false;

        document.querySelector(`#${setData.id}`).remove();

        return true;
    }
}

class CircleGame {
    constructor() {
        this.sounds = {
            bgm_main: new Audio('./res/bgm_main.mp3'),
            se_click: new Audio('./res/se_click.mp3')
        };

        for(let i = 0; i < 11; i++) {
            this.sounds[`se_pop_${i}`] = new Audio(`./res/se_pop-${i}.mp3`);
        }

        this.images = {
            pop: './res/pop.png'
        };

        for(let i = 0; i < 11; i++) {
            this.images[`circle_${i}`] = `./res/circle_fruits-${i}.png`;
        }

        let circle_radius_array = [ 24, 32, 40, 56, 64, 72, 84, 96, 128, 160, 192 ];
        let circle_points_array = [ 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33 ];

        this.circles = [];

        for(let i = 0; i < 11; i++) {
            this.circles[i] = {
                radius: circle_radius_array[i],
                points: circle_points_array[i],

                img_src: this.images[`circle_${i}`],

                se_pop: this.sounds[`se_pop_${i}`]
            };
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////

        this.settings = {
            playBGM: true,
            playSE:  true
        };

        this.configs = {
            frictionParameters: {
                friction:       0.006,
                frictionStatic: 0.006,
                frictionAir:    0,
                restitution:    0.1
            },

            canvas: {
                width:  640,
                height: 960,

                backgroundColor: '#ffdcae',

                bottom: {
                    height: 48,

                    backgroundColor: '#ffd59d'
                }
            }
        };

        ////////////////////////////////////////////////////////////////////////////////////////////////////

        this.constants = {
            gameStates: {
                UNINITIALIZED: 0,
                INITIALIZED:   1,
                START:         2,
                READY:         3,
                DROP:          4,
                END:           5
            }
        };

        this.state = this.constants.gameStates.UNINITIALIZED;

        // 擬似乱数生成アルゴリズム
        function mulberry32(a) {
            return function() {
                let t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        }

        this.getRandomNum = mulberry32(Date.now());
    }

    initialize(selectors = 'body') {
        if(!this.state) {
            if(this.settings.playBGM) {
                this.sounds.bgm_main.loop = true;
                this.sounds.bgm_main.play();
                this.sounds.bgm_main.volume = 1;
            }

            let clickEvent = (event) => {
                if(this.settings.playSE) this.sounds.se_click.play();
            };

            document.addEventListener('click', clickEvent);
            document.addEventListener('touchend', clickEvent);
        }

        if(document.querySelector(`${selectors} .circleGame`)) document.querySelector(`${selectors} .circleGame`).remove();

        document.querySelector(selectors).innerHTML += `
            <div class="circleGame">
                <div class="container"></div>
            </div>
        `;

        this.matter = {
            engine: Engine.create(),
            runner: Runner.create()
        };

        this.matter.render = Render.create({
            element: document.querySelector(`.circleGame .container`),
            engine: this.matter.engine,
            options: {
                width: this.configs.canvas.width,
                height: this.configs.canvas.height,
                wireframes: false,
                background: this.configs.canvas.backgroundColor
            }
        });

        this.matter.mouse = Mouse.create(this.matter.render.canvas);

        this.matter.mouseConstraint = MouseConstraint.create(this.matter.engine, {
            mouse: this.matter.mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        });

        this.matter.render.mouse = this.matter.mouse;

        if(!this.state) {
            let resizeCanvas = () => {
                let screenWidth  = window.clientWidth;
                let screenHeight = window.clientHeight;

                let newWidth  = this.configs.canvas.width;
                let newHeight = this.configs.canvas.height;
                let scale     = 1;

                if((screenWidth * 1.5) > screenHeight) {
                    newWidth  = newHeight / 1.5;
                    newHeight = Math.min(this.configs.canvas.height, screenHeight);
                    scale     = newHeight / this.configs.canvas.height;
                } else {
                    newWidth  = Math.min(this.configs.canvas.width, screenWidth);
                    newHeight = newWidth * 1.5;
                    scale     = newWidth / this.configs.canvas.width;
                }

                this.matter.render.canvas.style.width  = `${newWidth}px`;
                this.matter.render.canvas.style.height = `${newHeight}px`;
            };

            resizeCanvas();

            document.body.onresize = resizeCanvas;
        }

        this.game_mergedCircles = Array.apply(null, Array(this.circles.length)).map(() => 0);

        this.score_current = 0;
        this.score_high    = 0;

        this.circle_current = 0;
        this.circle_next    = 0;

        this.state = this.constants.gameStates.INITIALIZED;

        return true;
    }

    setting(setData = {}) {
        if('playBGM' in setData) this.settings.playBGM = setData.playBGM;
        if('playSE'  in setData) this.settings.playSE  = setData.playSE;

        if(this.settings.playBGM) {
            this.sounds.bgm_main.play();
            this.sounds.bgm_main.volume = 1;
        } else {
            this.sounds.bgm_main.pause();
            this.sounds.bgm_main.volume = 0;
        }

        return true;
    }

    calculateScore() {
        return this.game_mergedCircles.reduce((total, count, index) => {
            let value = this.circles[index].points * count;

            return total + value;
        }, 0);
    }

    generateCircleBody(x, y, index, options = {}) {
        let circle = this.circles[index];

        let circleObject = Bodies.circle(x, y, circle.radius, {
            ...this.configs.frictionParameters,
            ...options,
            render: {
                sprite: {
                    texture: circle.img_src,
                    xScale: circle.radius / 512,
                    yScale: circle.radius / 512
                }
            }
        });

        circleObject.index = index;

        return circleObject;
    }

    addCircle(x) {
        if(this.state != this.constants.gameStates.READY) return false;

        this.state = this.constants.gameStates.DROP;

        Composite.add(this.matter.engine.world, this.generateCircleBody(x, 0, this.circle_current));

        this.circle_current = this.circle_next;
        this.circle_next    = Math.floor(this.getRandomNum() * 5); // 0 から 4

        Composite.remove(this.matter.engine.world, this.game_previewCircle);

        this.game_previewCircle = this.generateCircleBody(
            this.matter.render.mouse.position.x,
            0,
            this.circle_current,
            {
                isStatic: true,
                collisionFilter: {
                    mask: 0x0040
                }
            }
        );

        return setTimeout(() => {
            if(this.state == this.constants.gameStates.DROP) {
                Composite.add(this.matter.engine.world, this.game_previewCircle);

                this.state = this.constants.gameStates.READY;
            }
        }, 500);
    }

    addPop(x, y, r) {
        let circleObject = Bodies.circle(x, y, r, {
            isStatic: true,
            collisionFilter: {
                mask: 0x0040
            },
            angle: this.getRandomNum() * (Math.PI * 2),
            render: {
                sprite: {
                    texture: this.images.pop,
                    xScale: r / 384,
                    yScale: r / 384,
                }
            }
        });

        Composite.add(this.matter.engine.world, circleObject);

        return setTimeout(() => {
            Composite.remove(this.matter.engine.world, circleObject);
        }, 100);
    }

    end() {
        this.state = this.constants.gameStates.END;

        this.matter.runner.enabled = false;

        let score = this.calculateScore();

        if(score > this.score_high) this.score_high = score;

        return true;
    }

    start() {
        if(this.state != this.constants.gameStates.INITIALIZED) return false;

        this.state = this.constants.gameStates.START;

        Render.run(this.matter.render);
        Runner.run(this.matter.runner, this.matter.engine);

        let stage_padding = 64;
        let stage_bottom_height = this.configs.canvas.bottom.height;
        let stage_options = {
            isStatic: true,
            render: {
                fillStyle: this.configs.canvas.bottom.backgroundColor
            },
            ...this.configs.frictionParameters,
        };

        let stageObjects = [
            Bodies.rectangle(
                -(stage_padding / 2),
                this.configs.canvas.height / 2,
                stage_padding,
                this.configs.canvas.height,
                stage_options
            ),

            Bodies.rectangle(
                this.configs.canvas.width + (stage_padding / 2),
                this.configs.canvas.height / 2,
                stage_padding,
                this.configs.canvas.height,
                stage_options
            ),

            Bodies.rectangle(
                this.configs.canvas.width / 2,
                this.configs.canvas.height + (stage_padding / 2) - stage_bottom_height,
                this.configs.canvas.width,
                stage_padding,
                stage_options
            )
        ];

        Composite.add(this.matter.engine.world, stageObjects);

        this.game_previewCircle = this.generateCircleBody(
            this.configs.canvas.width / 2,
            0,
            this.circle_current,
            {
                isStatic: true
            }
        );

        Composite.add(this.matter.engine.world, this.game_previewCircle);

        Events.on(this.matter.mouseConstraint, 'mousemove', (e) => {
            if(this.state != this.constants.gameStates.READY) return false;
            if(!this.game_previewCircle) return false;

            this.game_previewCircle.position.x = e.mouse.position.x;
        });

        Events.on(this.matter.mouseConstraint, 'mouseup', (e) => {
            this.addCircle(e.mouse.position.x);

            this.score_current = this.calculateScore();
        });

        Events.on(this.matter.engine, 'collisionStart', (e) => {
            for(let i = 0; i < e.pairs.length; i++) {
                const { bodyA, bodyB } = e.pairs[i];

                if(bodyA.isStatic || bodyB.isStatic) continue;

                let aY = bodyA.position.y + bodyA.circleRadius;
                let bY = bodyB.position.y + bodyB.circleRadius;

                let loseHeight = 84;

                if(aY < loseHeight || bY < loseHeight) {
                    this.end();
                    return false;
                }

                if(bodyA.index !== bodyB.index) continue;

                let newIndex = bodyA.index + 1;

                if(bodyA.circleRadius >= this.circles[this.circles.length - 1].circleRadius) newIndex = 0;

                this.game_mergedCircles[bodyA.index] += 1;

                let midPosX = (bodyA.position.x + bodyB.position.x) / 2;
                let midPosY = (bodyA.position.y + bodyB.position.y) / 2;

                if(this.settings.playSE) this.circles[bodyA.index].se_pop.play();

                Composite.remove(this.matter.engine.world, [ bodyA, bodyB ]);
                Composite.add(this.matter.engine.world, this.generateCircleBody(midPosX, midPosY, newIndex));

                this.addPop(midPosX, midPosY, bodyA.circleRadius);

                this.score_current = this.calculateScore();
            }
        });

        return setTimeout(() => {
            this.state = this.constants.gameStates.READY;
        }, 250);
    }
}

class App {
    constructor() {
        this.modal = new Modal();
        this.game  = new CircleGame();

        window.addEventListener('load', () => {
            if(window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('darkMode');

            let checkDeviceType = (event) => {
                let deviceType = event.changedTouches ? 'touch' : 'mouse' ;

                switch(deviceType) {
                    case 'touch':
                        document.body.classList.add('touchDevice');
                        break;

                    case 'mouse':
                        document.body.classList.remove('touchDevice');
                        break;
                }

                window.removeEventListener('mousemove', checkDeviceType);
                window.removeEventListener('touchstart', checkDeviceType);
            };

            window.addEventListener('mousemove', checkDeviceType);
            window.addEventListener('touchstart', checkDeviceType);

            let lsData = this.storageGetData();

            if(lsData) {
                if('playBGM' in lsData) this.game.settings.playBGM = lsData.playBGM;
                if('playSE'  in lsData) this.game.settings.playSE  = lsData.playSE;
            }

            this.modal.render({ content: `
                <h1><i class="bi bi-music-note-beamed"></i></h1>
                <p>このゲームでは音が流れます！<br>（設定でオフにできます。）</p>
                <button class="clickable" onclick="app.modal.destroy();app.initialize();">閉じる</button>
            ` });

            document.body.innerHTML += `<main><div class="container"></div></main>`;
        });
    }

    storageGetData(key = '') {
        let lsKey = location.href;

        let isObject = function(value) {
            return value !== null && typeof value === 'object';
        };

        let lsData = localStorage.getItem(lsKey);

        if(!lsData) return null;

        lsData = JSON.parse(lsData);

        if(!isObject(lsData)) return false;

        if(key) {
            if(key in lsData) return lsData[key];
            else return null;
        }

        return lsData;
    }

    storageSetData(setData = {}) {
        let lsKey = location.href;

        let isObject = function(value) {
            return value !== null && typeof value === 'object';
        };

        if(!isObject(setData)) return false;

        setData = JSON.stringify(setData);

        localStorage.setItem(lsKey, setData);

        return true;
    }

    setting(setData = {}) {
        let modalID = 'modal-app-setting';

        if(!document.querySelector(`#${modalID}`)) {
            let modalContent = `
                <h1><i class="bi bi-gear-wide-connected"></i> 設定</h1>
                <p>
                    BGM: <u id="playBGM">unknown</u><br>
                    SE: <u id="playSE">unknown</u><br><br>
                    テーマ: <u onclick="window.alert('coming soon!');" style="opacity: 0.5;">デフォルト</u><br><br>
                    <u onclick="app.setting({ 'dataReset': true });">データをリセット</u>
                </p>
                <button class="clickable" onclick="app.modal.destroy({ 'id': '${modalID}' });">閉じる</button>
            `

            if(!this.modal.render({ id: modalID, content: modalContent })) return false;
        }

        if('playBGM' in setData) this.game.setting({ playBGM: setData.playBGM });
        if('playSE'  in setData) this.game.setting({ playSE:  setData.playSE  });

        if(document.querySelector(`#${modalID}`)) {
            let button_playBGM = document.querySelector(`#${modalID} #playBGM`);
            let button_playSE  = document.querySelector(`#${modalID} #playSE`);

            switch(this.game.settings.playBGM) {
                case true:
                    button_playBGM.innerHTML = 'オン';
                    button_playBGM.setAttribute('onclick', `app.setting({ 'playBGM': false });`);
                    break;

                case false:
                    button_playBGM.innerHTML = 'オフ';
                    button_playBGM.setAttribute('onclick', `app.setting({ 'playBGM': true });`);
                    break;
            }

            switch(this.game.settings.playSE) {
                case true:
                    button_playSE.innerHTML = 'オン';
                    button_playSE.setAttribute('onclick', `app.setting({ 'playSE': false });`);
                    break;

                case false:
                    button_playSE.innerHTML = 'オフ';
                    button_playSE.setAttribute('onclick', `app.setting({ 'playSE': true });`);
                    break;
            }
        }

        let lsData = this.storageGetData();

        if(!lsData) lsData = {};

        lsData.playBGM = this.game.settings.playBGM;
        lsData.playSE  = this.game.settings.playSE;

        if(!this.storageSetData(lsData)) return false;

        if('dataReset' in setData) {
            if(setData.dataReset) {
                let result = window.confirm('スコアや設定をリセットします。本当にリセットしますか？');

                if(result) {
                    this.storageSetData({});

                    window.alert('リセットが完了しました。再起動します。');

                    location.reload();
                }
            }
        }

        return true;
    }

    gameReset() {
        if(!this.game.initialize('main .container')) return false;
        if(!this.game.start()) return false;

        return true;
    }

    initialize() {
        if(document.querySelector('header')) document.querySelector('header').remove();
        if(document.querySelector('main'))   document.querySelector('main')  .remove();
        if(document.querySelector('footer')) document.querySelector('footer').remove();

        document.body.innerHTML += `
            <main>
                <div class="container"></div>
            </main>
            <header>
                <div class="container">
                    <p class="scoreBoard"></p>
                    <div onclick="app.setting();"><i class="bi bi-gear-wide-connected"></i></div>
                </div>
            </header>
            <footer>
                <div class="container">
                    <p>© 2023 <a href="//github.com/kanaaa224/" target="_blank">kanaaa224</a>.</p>
                </div>
            </footer>
        `;

        if(!this.gameReset()) return false;

        this.interval = setInterval(() => {
            switch(this.game.state) {
                case this.game.constants.gameStates.READY:
                case this.game.constants.gameStates.DROP: {
                    let highScore = this.storageGetData('highScore') ?? 0;

                    document.querySelector('header .container .scoreBoard').innerHTML = `
                        スコア: ${this.game.score_current}<br>
                        ハイスコア: ${highScore}
                    `;

                    break;
                }

                case this.game.constants.gameStates.END: {
                    let modalID = 'modal-game-over';

                    if(!document.querySelector(`#${modalID}`)) {
                        let score_current = this.game.score_current;
                        let score_high    = this.game.score_high;

                        let highScore = this.storageGetData('highScore') ?? 0;

                        if(score_high > highScore) {
                            let lsData = this.storageGetData();

                            if(!lsData) lsData = {};

                            lsData.highScore = score_high;

                            if(!this.storageSetData(lsData)) return false;
                        }

                        let modalContent = `
                            <h1>ゲームオーバー</h1>
                            <p>スコア: ${score_current}${score_high > highScore ? '（ハイスコア！）' : ''}</p>
                            <button class="clickable" onclick="app.gameReset();app.modal.destroy({ 'id': '${modalID}' });">閉じる</button>
                        `

                        if(!this.modal.render({ id: modalID, content: modalContent })) return false;
                    }

                    break;
                }

                default: {
                    break;
                }
            }
        }, 100);

        return true;
    }
}

const {
    Engine, Render, Runner, Composites, Common, MouseConstraint, Mouse, Composite, Bodies, Events,
} = Matter;

const app = new App();