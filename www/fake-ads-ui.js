(function (w) {
    if (!w.coreSDK) return;

    class FakeAdsMediator {
        constructor() {
            this.loadedPlacements = new Set();
            this.destroyed = false;
        }

        // === REQUIRED BY SDK ===
        async init(adsConfig, environment) {
            console.log('[FakeAds] init', { environment });
            this.destroyed = false;
        }

        // === REQUIRED BY SDK ===
        async load(type, placement, placementConfig) {
            if (this.destroyed) {
                throw new Error('MEDIATOR_DESTROYED');
            }

            // already loaded → OK
            if (this.loadedPlacements.has(placement)) {
                return;
            }

            console.log('[FakeAds] load', { type, placement });

            // emulate async SDK loading
            await new Promise(resolve => setTimeout(resolve, 400));

            this.loadedPlacements.add(placement);
        }

        // === REQUIRED BY SDK ===
        show(type, placement, placementConfig, done) {
            if (this.destroyed) {
                done({
                    status: 'INTERNAL_ERROR',
                    canReward: false,
                    errorMessage: 'Mediator destroyed',
                });
                return;
            }

            // banners are instant
            if (type === 'banner') {
                done({
                    status: 'COMPLETED',
                    canReward: false,
                });
                return;
            }

            // rewarded / interstitial
            const rewardType = placementConfig.rewardType;
            const rewardAmount = placementConfig.rewardAmount;
            const rewardText =
                rewardType && rewardAmount
                    ? `${rewardAmount} ${rewardType}`
                    : '';

            const root = document.createElement('div');
            root.setAttribute('data-fake-ad', '');

            Object.assign(root.style, {
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999,
                fontFamily: 'system-ui, -apple-system',
                color: '#fff',
            });

            root.innerHTML = `
              <div style="
                background: linear-gradient(180deg,#111,#1a1a1a);
                padding:24px;
                border-radius:16px;
                width:320px;
                text-align:center;
                box-shadow: 0 20px 40px rgba(0,0,0,.6);
              ">
                <div style="font-size:20px;margin-bottom:8px">
                  🎬 Fake ${type} Ad
                </div>

                ${
                rewardText
                    ? `
                  <div style="opacity:.7;margin-bottom:12px">
                    Watch the ad to earn:
                  </div>
                  <div style="font-size:22px;font-weight:600;margin-bottom:16px">
                    🪙 ${rewardText}
                  </div>
                `
                    : ''
            }

                <div id="fake-ad-timer" style="opacity:.6;margin-bottom:16px">
                  Watching ad…
                </div>

                <div style="display:flex;gap:12px;justify-content:center">
                  <button id="fake-ad-cancel" style="
                    padding:10px 14px;
                    border-radius:10px;
                    border:none;
                    background:#333;
                    color:#fff;
                    cursor:pointer;
                  ">
                    Close
                  </button>

                  <button id="fake-ad-finish" style="
                    padding:10px 14px;
                    border-radius:10px;
                    border:none;
                    background:#4CAF50;
                    color:#000;
                    font-weight:600;
                    cursor:pointer;
                  ">
                    Finish Ad
                  </button>
                </div>
              </div>
            `;

            document.body.appendChild(root);

            const timerEl = root.querySelector('#fake-ad-timer');
            let seconds = 3;

            const interval = setInterval(() => {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(interval);
                    timerEl.textContent = 'You can finish the ad';
                } else {
                    timerEl.textContent = `Watching ad… ${seconds}s`;
                }
            }, 1000);

            const cleanup = () => {
                clearInterval(interval);
                root.remove();
            };

            root.querySelector('#fake-ad-cancel').onclick = () => {
                cleanup();
                done({
                    status: 'CANCELLED',
                    canReward: false,
                });
            };

            root.querySelector('#fake-ad-finish').onclick = () => {
                cleanup();
                done({
                    status: rewardType ? 'REWARD_GRANTED' : 'COMPLETED',
                    canReward: Boolean(rewardType),
                    rewardType: rewardType ?? null,
                    rewardAmount: rewardAmount ?? null,
                });
            };
        }

        // === OPTIONAL BUT EXPECTED BY SDK ===
        destroy() {
            console.log('[FakeAds] destroy');
            this.destroyed = true;
            this.loadedPlacements.clear();
        }
    }

    // === REGISTER MEDIATOR ===
    coreSDK.ads.registerMediator('fake', () => new FakeAdsMediator());

    // === TEST CONFIG ===
    coreSDK.__setConfigForTests('ads', {
        enabled: true,
        defaults: {
            preloadOnStart: true,
        },
        placements: {
            reward_after_level: {
                type: 'rewarded',
                rewardType: 'coins',
                rewardAmount: 50,
                web: {
                    mediator: 'fake',
                },
            },
        },
    });

    coreSDK.initAds();

    console.log('[FakeAds] ready');
})(window);
