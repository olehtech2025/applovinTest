/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready

document.addEventListener('deviceready', async () => {
    console.log('[APP] deviceready');

    console.log('[CHECK] location =', window.location.href);
    console.log('[CHECK] cordova =', !!window.cordova);
    console.log('[CHECK] AppLovinMAX =', window.AppLovinMAX);
    console.log('[CHECK] applovin =', window.applovin);
    console.log('[CHECK] window =', window);

    coreSDK.ads.registerMediator(
        'applovin',
        window.AppLovinMediator
    );

    const adsConfig = {
        enabled: true,
        defaults: {
            preloadOnStart: true,
            loadTimeoutMs: 30000,
            showTimeoutMs: 60000,
        },
        mediators: {
            applovin: {
                sdkKey: 'VB_0zSp_AExpJn74kcSysTwAMgnwt8wLq2TUvGUU9LxLT3HCmDiFMRQhEnowdyOOWK1fDsgn5XkIM0zpXqT2Fi',
            },
        },
        placements: {
            aoa: {
                type: 'interstitial',
                cordova: {
                    mediator: 'applovin',
                    adUnitId: 'ec645817ca73545e',
                },
            },
            mrec: {
                type: 'banner',
                format: 'mrec',
                cordova: {
                    mediator: 'applovin',
                    adUnitId: '16681fe5496c8b56',
                },
            },
            reward: {
                type: 'rewarded',
                cordova: {
                    mediator: 'applovin',
                    adUnitId: 'd2d8ec71ef348184',
                },
            },
            find_object_inter: {
                type: 'interstitial',
                cordova: {
                    mediator: 'applovin',
                    adUnitId: '599eb0c0de95ab11',
                },
            },
            find_object_banner: {
                type: 'banner',
                cordova: {
                    mediator: 'applovin',
                    adUnitId: '2bcee5347a2c6bd6',
                },
            },
        },
    };

    coreSDK.__setConfigForTests('ads', adsConfig);

    // init SDK
    await coreSDK.init({
        version: '1.0.80',
        skipAuth: true,
    });

    // init ads
    await coreSDK.initAds();
    console.log('[ADS] initAds completed');

    const placements = {
        aoa: { type: 'interstitial', name: 'AOA (interstitial)' },
        find_object_inter: { type: 'interstitial', name: 'Find Object Inter' },
        reward: { type: 'rewarded', name: 'Reward' },
        find_object_banner: { type: 'banner', name: 'Find Object Banner' },
        mrec: { type: 'banner', name: 'MREC' },
    };

    const getAdUnitId = placement => {
        const placementConfig = adsConfig?.placements?.[placement];
        const envConfig =
            placementConfig?.cordova ||
            placementConfig?.android ||
            placementConfig?.ios ||
            placementConfig;
        return envConfig?.adUnitId || null;
    };

    const logToPanel = (panel, message) => {
        const line = document.createElement('div');
        line.textContent = message;
        panel.prepend(line);
    };

    const createButton = (label, onClick) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.padding = '10px 12px';
        button.style.borderRadius = '10px';
        button.style.border = '1px solid #2a2a2a';
        button.style.background = '#f2f2f2';
        button.style.color = '#111';
        button.style.cursor = 'pointer';
        button.onclick = onClick;
        return button;
    };

    const safeCordovaRequire = moduleId => {
        if (!window.cordova?.require) return null;
        try {
            return window.cordova.require(moduleId);
        } catch (err) {
            return null;
        }
    };

    const getMaxSdk = () =>
        window.AppLovinMAX ||
        window.applovin ||
        safeCordovaRequire('cordova-plugin-applovin-max.AppLovinMAX');

    const hideAdView = (placement, format) => {
        const adUnitId = getAdUnitId(placement);
        const sdk = getMaxSdk();
        if (!sdk) {
            return false;
        }

        try {
            if (format === 'mrec' && typeof sdk.hideMRec === 'function') {
                adUnitId ? sdk.hideMRec(adUnitId) : sdk.hideMRec();
                return true;
            }
            if (format === 'banner' && typeof sdk.hideBanner === 'function') {
                adUnitId ? sdk.hideBanner(adUnitId) : sdk.hideBanner();
                return true;
            }
        } catch (err) {
            console.warn('[ADS] hideAdView failed', err);
        }

        return false;
    };

    const createTestPanel = () => {
        const panel = document.createElement('div');
        panel.id = 'applovin-test-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            left: '12px',
            right: '12px',
            bottom: '12px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #ddd',
            borderRadius: '14px',
            padding: '12px',
            fontFamily: 'system-ui, -apple-system',
            zIndex: 999999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        });

        const title = document.createElement('div');
        title.textContent = 'AppLovin placements (Android)';
        title.style.fontWeight = '600';
        title.style.marginBottom = '8px';
        panel.appendChild(title);

        const buttons = document.createElement('div');
        buttons.style.display = 'grid';
        buttons.style.gridTemplateColumns = '1fr 1fr';
        buttons.style.gap = '8px';
        panel.appendChild(buttons);

        const log = document.createElement('div');
        log.style.marginTop = '10px';
        log.style.maxHeight = '120px';
        log.style.overflow = 'auto';
        log.style.fontSize = '12px';
        log.style.color = '#333';
        panel.appendChild(log);

        const showPlacement = (type, placement, name) => async () => {
            //logToPanel(log, `Show ${name}...`);
            const result = await coreSDK.showAd(type, placement);
            console.log('[TEST][RESULT]', placement, result);
            //logToPanel(log, `${name}: ${result?.status || 'UNKNOWN'}`);
        };

        buttons.appendChild(
            createButton(placements.aoa.name, showPlacement('interstitial', 'aoa', placements.aoa.name))
        );
        buttons.appendChild(
            createButton(
                placements.find_object_inter.name,
                showPlacement('interstitial', 'find_object_inter', placements.find_object_inter.name)
            )
        );
        buttons.appendChild(
            createButton(placements.reward.name, showPlacement('rewarded', 'reward', placements.reward.name))
        );
        buttons.appendChild(
            createButton(
                placements.find_object_banner.name,
                showPlacement('banner', 'find_object_banner', placements.find_object_banner.name)
            )
        );
        buttons.appendChild(
            createButton(placements.mrec.name, showPlacement('banner', 'mrec', placements.mrec.name))
        );

        buttons.appendChild(
            createButton('Hide banner', () => {
                if (hideAdView('find_object_banner', 'banner')) {
                    //logToPanel(log, 'Hide banner');
                }
            })
        );

        buttons.appendChild(
            createButton('Hide MREC', () => {
                if (hideAdView('mrec', 'mrec')) {
                    //logToPanel(log, 'Hide MREC');
                }
            })
        );

        document.body.appendChild(panel);
    };

    createTestPanel();
});
