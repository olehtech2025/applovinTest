(function (w) {
    console.log('[AppLovinMediator] loaded');

    class AppLovinMediator {
        constructor() {
            this.ready = new Map();
            this.loading = new Map();
            this.adViews = new Set();
            this.initialized = false;
            this.initPromise = null;
            this.max = null;
            this.loadTimeoutMs = 15000;
            this.showTimeoutMs = 15000;
        }

        async init(adsConfig) {
            if (this.initialized) return;
            if (this.initPromise) return this.initPromise;

            this.initPromise = (async () => {
                await this.waitForDeviceReady();

                const sdk = await this.waitForSdk(15000);
                if (!sdk) {
                    throw new Error('APPLOVIN_MAX_NOT_AVAILABLE');
                }

                this.loadTimeoutMs =
                    adsConfig?.defaults?.loadTimeoutMs ?? this.loadTimeoutMs;
                this.showTimeoutMs =
                    adsConfig?.defaults?.showTimeoutMs ?? this.showTimeoutMs;

                const sdkKey = adsConfig?.mediators?.applovin?.sdkKey;
                if (!sdkKey) {
                    throw new Error('SDK_KEY_MISSING');
                }

                await new Promise(resolve => {
                    sdk.initialize(sdkKey, () => {
                        console.log('[AppLovin] initialized');
                        sdk.setTestDeviceAdvertisingIds(['EMULATOR']);
                        resolve();
                    });
                });

                this.max = sdk;
                this.initialized = true;
            })();

            return this.initPromise;
        }

        async load(type, placement, placementConfig) {
            if (!['rewarded', 'interstitial', 'banner'].includes(type)) return;
            if (!this.initialized || !this.max) {
                if (this.initPromise) {
                    await this.initPromise;
                }
                if (!this.initialized || !this.max) {
                    throw new Error('NOT_INITIALIZED');
                }
            }

            const envConfig =
                placementConfig?.cordova ||
                placementConfig?.android ||
                placementConfig?.ios ||
                placementConfig;
            const adUnitId = envConfig?.adUnitId;
            if (!adUnitId) {
                throw new Error('AD_UNIT_ID_MISSING');
            }

            if (this.ready.get(placement)) return;

            const inFlight = this.loading.get(adUnitId);
            if (inFlight) return inFlight;

            const loadPromise = new Promise((resolve, reject) => {
                const timeoutMs = this.getTimeoutMs(
                    placementConfig,
                    'loadTimeoutMs',
                    this.loadTimeoutMs
                );

                const onLoaded = evt => {
                    if (evt?.adUnitId !== adUnitId) return;
                    this.ready.set(placement, true);
                    cleanup();
                    resolve();
                };

                const onFailed = evt => {
                    if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                    cleanup();
                    reject(new Error('LOAD_FAILED'));
                };

                let loadedEvent = null;
                let failedEvent = null;
                let timeoutId = null;

                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (loadedEvent) {
                        window.removeEventListener(loadedEvent, onLoaded);
                    }
                    if (failedEvent) {
                        window.removeEventListener(failedEvent, onFailed);
                    }
                };

                if (type === 'rewarded') {
                    loadedEvent = 'OnRewardedAdLoadedEvent';
                    failedEvent = 'OnRewardedAdLoadFailedEvent';
                    window.addEventListener(loadedEvent, onLoaded);
                    window.addEventListener(failedEvent, onFailed);
                    timeoutId = setTimeout(() => {
                        cleanup();
                        reject(new Error('LOAD_TIMEOUT'));
                    }, timeoutMs);
                    this.max.loadRewardedAd(adUnitId);
                    return;
                }

                if (type === 'interstitial') {
                    loadedEvent = 'OnInterstitialLoadedEvent';
                    failedEvent = 'OnInterstitialLoadFailedEvent';
                    window.addEventListener(loadedEvent, onLoaded);
                    window.addEventListener(failedEvent, onFailed);
                    timeoutId = setTimeout(() => {
                        cleanup();
                        reject(new Error('LOAD_TIMEOUT'));
                    }, timeoutMs);
                    this.max.loadInterstitial(adUnitId);
                    return;
                }

                const format = this.getAdViewFormat(placementConfig);
                loadedEvent =
                    format === 'mrec'
                        ? 'OnMRecAdLoadedEvent'
                        : 'OnBannerAdLoadedEvent';
                failedEvent =
                    format === 'mrec'
                        ? 'OnMRecAdLoadFailedEvent'
                        : 'OnBannerAdLoadFailedEvent';

                window.addEventListener(loadedEvent, onLoaded);
                window.addEventListener(failedEvent, onFailed);
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error('LOAD_TIMEOUT'));
                }, timeoutMs);
                this.ensureAdViewCreated(adUnitId, format, placement, placementConfig);
            }).finally(() => {
                this.loading.delete(adUnitId);
            });

            this.loading.set(adUnitId, loadPromise);
            return loadPromise;
        }

        show(type, placement, placementConfig, done) {
            if (!this.initialized || !this.max) {
                done({ status: 'NOT_READY', canReward: false });
                return;
            }

            const envConfig =
                placementConfig?.cordova ||
                placementConfig?.android ||
                placementConfig?.ios ||
                placementConfig;
            const adUnitId = envConfig?.adUnitId;
            if (!adUnitId) {
                done({ status: 'NOT_READY', canReward: false });
                return;
            }

            if (type === 'banner') {
                const format = this.getAdViewFormat(placementConfig);
                const isReady = this.ready.get(placement);
                if (!isReady) {
                    done({ status: 'NOT_READY', canReward: false });
                    return;
                }

                this.ensureAdViewCreated(
                    adUnitId,
                    format,
                    placement,
                    placementConfig
                );

                if (format === 'mrec') {
                    this.max.showMRec(adUnitId);
                } else {
                    this.max.showBanner(adUnitId);
                }

                done({ status: 'COMPLETED', canReward: false });
                return;
            }

            if (type === 'interstitial') {
                const isReady =
                    this.ready.get(placement) ||
                    this.max.isInterstitialReady(adUnitId);

                if (!isReady) {
                    done({ status: 'NOT_READY', canReward: false });
                    return;
                }

                let finished = false;

                const finish = res => {
                    if (finished) return;
                    finished = true;
                    this.ready.set(placement, false);
                    cleanup();
                    done(res);
                };

                const onFailedToDisplay = evt => {
                    if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                    finish({
                        status: 'SHOW_FAILED',
                        canReward: false,
                        errorMessage: evt?.errorMessage || 'SHOW_FAILED',
                    });
                };

                const onHidden = evt => {
                    if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                    this.ready.set(placement, false);
                    finish({ status: 'COMPLETED', canReward: false });
                };

                let timeoutId = null;

                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    window.removeEventListener(
                        'OnInterstitialAdFailedToDisplayEvent',
                        onFailedToDisplay
                    );
                    window.removeEventListener(
                        'OnInterstitialHiddenEvent',
                        onHidden
                    );
                };

                window.addEventListener(
                    'OnInterstitialAdFailedToDisplayEvent',
                    onFailedToDisplay
                );
                window.addEventListener('OnInterstitialHiddenEvent', onHidden);

                timeoutId = setTimeout(() => {
                    finish({ status: 'TIMEOUT', canReward: false });
                }, this.getTimeoutMs(placementConfig, 'showTimeoutMs', this.showTimeoutMs));

                this.max.showInterstitial(adUnitId, placement);
                return;
            }

            if (type !== 'rewarded') {
                done({ status: 'NOT_READY', canReward: false });
                return;
            }

            const isReady =
                this.ready.get(placement) || this.max.isRewardedAdReady(adUnitId);

            if (!isReady) {
                done({ status: 'NOT_READY', canReward: false });
                return;
            }

            let finished = false;
            let rewarded = false;

            const finish = res => {
                if (finished) return;
                finished = true;
                this.ready.set(placement, false);
                cleanup();
                done(res);
            };

            const onReward = evt => {
                if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                rewarded = true;
                finish({
                    status: 'REWARD_GRANTED',
                    canReward: true,
                    rewardType: placementConfig.rewardType,
                    rewardAmount: placementConfig.rewardAmount,
                });
            };

            const onFailedToDisplay = evt => {
                if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                finish({
                    status: 'SHOW_FAILED',
                    canReward: false,
                    errorMessage: evt?.errorMessage || 'SHOW_FAILED',
                });
            };

            const onHidden = evt => {
                if (evt?.adUnitId && evt.adUnitId !== adUnitId) return;
                this.ready.set(placement, false);
                if (!rewarded) {
                    finish({ status: 'CLOSED', canReward: false });
                }
            };

            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                window.removeEventListener('OnRewardedAdReceivedRewardEvent', onReward);
                window.removeEventListener(
                    'OnRewardedAdFailedToDisplayEvent',
                    onFailedToDisplay
                );
                window.removeEventListener('OnRewardedAdHiddenEvent', onHidden);
            };

            window.addEventListener('OnRewardedAdReceivedRewardEvent', onReward);
            window.addEventListener(
                'OnRewardedAdFailedToDisplayEvent',
                onFailedToDisplay
            );
            window.addEventListener('OnRewardedAdHiddenEvent', onHidden);

            timeoutId = setTimeout(() => {
                finish({ status: 'TIMEOUT', canReward: false });
            }, this.getTimeoutMs(placementConfig, 'showTimeoutMs', this.showTimeoutMs));

            this.max.showRewardedAd(adUnitId, placement);
        }

        getAdViewFormat(placementConfig) {
            const envConfig =
                placementConfig?.cordova ||
                placementConfig?.android ||
                placementConfig?.ios ||
                placementConfig;
            const format =
                envConfig?.adViewFormat ||
                envConfig?.format ||
                placementConfig?.adViewFormat ||
                placementConfig?.format ||
                'banner';
            return format === 'mrec' ? 'mrec' : 'banner';
        }

        getAdViewPosition(placementConfig, format) {
            const envConfig =
                placementConfig?.cordova ||
                placementConfig?.android ||
                placementConfig?.ios ||
                placementConfig;
            const position =
                envConfig?.adViewPosition ||
                envConfig?.position ||
                envConfig?.bannerPosition ||
                envConfig?.mrecPosition ||
                placementConfig?.adViewPosition ||
                placementConfig?.position ||
                placementConfig?.bannerPosition ||
                placementConfig?.mrecPosition;
            if (position) return position;
            return format === 'mrec' ? 'centered' : 'bottom_center';
        }

        getTimeoutMs(placementConfig, key, fallback) {
            const envConfig =
                placementConfig?.cordova ||
                placementConfig?.android ||
                placementConfig?.ios ||
                placementConfig;
            const value = envConfig?.[key] ?? placementConfig?.[key];
            if (typeof value === 'number' && value > 0) return value;
            return fallback;
        }

        ensureAdViewCreated(adUnitId, format, placement, placementConfig) {
            if (this.adViews.has(adUnitId)) return;

            const position = this.getAdViewPosition(placementConfig, format);
            if (format === 'mrec') {
                this.max.createMRec(adUnitId, position);
                this.max.setMRecPlacement(adUnitId, placement);
            } else {
                this.max.createBanner(adUnitId, position);
                this.max.setBannerPlacement(adUnitId, placement);
            }

            this.adViews.add(adUnitId);
        }

        waitForSdk(timeoutMs) {
            const current = () =>
                w.applovin ||
                w.AppLovinMAX ||
                this.safeCordovaRequire('cordova-plugin-applovin-max.AppLovinMAX');
            const existing = current();
            if (existing) return Promise.resolve(existing);

            return new Promise(resolve => {
                const start = Date.now();
                const timer = setInterval(() => {
                    const sdk = current();
                    if (sdk || Date.now() - start >= timeoutMs) {
                        clearInterval(timer);
                        resolve(sdk || null);
                    }
                }, 100);
            });
        }

        waitForDeviceReady() {
            if (
                w.cordova?.channel?.onDeviceReady &&
                w.cordova.channel.onDeviceReady.fired
            ) {
                return Promise.resolve();
            }

            return new Promise(resolve =>
                document.addEventListener('deviceready', resolve, { once: true })
            );
        }

        safeCordovaRequire(moduleId) {
            if (!w.cordova?.require) return null;

            try {
                return w.cordova.require(moduleId);
            } catch (err) {
                return null;
            }
        }
    }

    w.AppLovinMediator = () => {
        if (!w.__applovinMediator) {
            w.__applovinMediator = new AppLovinMediator();
        }
        return w.__applovinMediator;
    };
})(window);
