import "mocha";
import {expect} from "chai";
import {FragmentBFF, FragmentStorefront} from "../src/lib/fragment";
import {IExposeFragment, IFragmentBFF} from "../src/types/fragment";
import nock from "nock";
import {FRAGMENT_RENDER_MODES, RESOURCE_INJECT_TYPE, RESOURCE_LOCATION, RESOURCE_TYPE} from "../src/lib/enums";
import {deepEqual} from "assert";

export default () => {
    describe('Fragment', () => {
        describe('BFF', () => {
            const commonFragmentBffConfiguration: any = {
                name: 'test',
                version: 'test',
                render: {
                    url: "/"
                },
                versions: {
                    "test": {
                        assets: [],
                        dependencies: [],
                        handler: {}
                    }
                }
            };

            it('should create a new FragmentBFF', () => {
                const fragmentConfig = JSON.parse(JSON.stringify(commonFragmentBffConfiguration));
                fragmentConfig.versions.test.handler.content = () => {
                };
                const fragment = new FragmentBFF(fragmentConfig);
                expect(fragment).to.be.instanceOf(FragmentBFF);
            });

            it('should render fragment as json format', async () => {
                const fragmentConfig = JSON.parse(JSON.stringify(commonFragmentBffConfiguration));
                fragmentConfig.versions.test.handler.content = (req: any, data: any) => {
                    return {
                        main: `${data} was here`
                    };
                };
                fragmentConfig.versions.test.handler.data = () => 'acg';
                const fragment = new FragmentBFF(fragmentConfig);
                const response = await fragment.render({});
                expect(response).to.deep.eq({
                    main: `acg was here`
                });
            });

            it('should throw at render error when not static and no data', done => {
                const fragmentConfig = JSON.parse(JSON.stringify(commonFragmentBffConfiguration));
                fragmentConfig.versions.test.handler.content = (req: any, data: any) => `${data} was here`;
                const fragment = new FragmentBFF(fragmentConfig);
                fragment.render({}).then(data => done(data)).catch(e => {
                    expect(e.message).to.include('Failed to find data handler');
                    done();
                });
            });

            it('should render fragment which is static without calling data', done => {
                const fragmentConfig = JSON.parse(JSON.stringify(commonFragmentBffConfiguration));
                fragmentConfig.render.static = true;
                fragmentConfig.versions.test.handler.content = (req: any, data: any) => `${data} was here`;
                fragmentConfig.versions.test.handler.data = (req: any) => {
                    throw new Error("It shouldn't call data for static fragments");
                };
                const fragment = new FragmentBFF(fragmentConfig);
                fragment.render({}).then(data => done()).catch(done);
            });

            it('should throw at render when failing to find version', done => {
                const fragmentConfig = JSON.parse(JSON.stringify(commonFragmentBffConfiguration));
                fragmentConfig.versions.test.handler.content = (req: any, data: any) => `${data} was here`;
                fragmentConfig.versions.test.handler.data = () => 'acg';
                const fragment = new FragmentBFF(fragmentConfig);
                fragment.render({}, 'no_version').then(data => done(data)).catch(e => {
                    expect(e.message).to.include('Failed to find fragment version');
                    done();
                });
            });
        });

        describe('Storefront', () => {
            const commonFragmentConfig: IExposeFragment = {
                version: '',
                testCookie: 'test',
                assets: [],
                dependencies: [],
                render: {
                    url: '/',
                    placeholder: true
                }
            };

            it('should create new storefront fragment instance', () => {
                const fragment = new FragmentStorefront('product', 'test');

                expect(fragment).to.be.instanceOf(FragmentStorefront);
            });

            it('should update fragment configuration', () => {
                const fragment = new FragmentStorefront('product', 'test');
                fragment.update(commonFragmentConfig, 'http://local.gatewaysimulator.com');

                expect(fragment.config).to.deep.eq(commonFragmentConfig);
            });

            it('should fetch placeholder', async () => {
                const placeholderContent = '<div>placeholder</div>';
                const scope = nock('http://local.gatewaysimulator.com')
                    .get('/product/placeholder')
                    .reply(200, placeholderContent);
                const fragment = new FragmentStorefront('product', 'test');
                fragment.update(commonFragmentConfig, 'http://local.gatewaysimulator.com');

                const placeholder = await fragment.getPlaceholder();
                expect(placeholder).to.eq(placeholderContent);
            });

            it('should return empty placeholder on any exception', async () => {
                const fragment = new FragmentStorefront('product', 'test');
                fragment.update(commonFragmentConfig, 'http://local.gatewaysimulator.com');

                const placeholder = await fragment.getPlaceholder();
                expect(placeholder).to.eq('');
            });

            it('should return fragment content', async () => {
                const fragmentContent = {
                    main: '<div>fragment</div>'
                };
                const scope = nock('http://local.gatewaysimulator.com')
                    .get('/product/')
                    .query({__renderMode: FRAGMENT_RENDER_MODES.STREAM})
                    .reply(200, fragmentContent);
                const fragment = new FragmentStorefront('product', 'test');
                fragment.update(commonFragmentConfig, 'http://local.gatewaysimulator.com');

                const content = await fragment.getContent();
                expect(content.html).to.deep.eq(fragmentContent);
            });

            it('should pass fragment attributes to gateway request', async () => {
                const fragmentContent = {
                    main: '<div>fragment</div>'
                };
                const scope = nock('http://local.gatewaysimulator.com')
                    .get('/product/')
                    .query({__renderMode: FRAGMENT_RENDER_MODES.STREAM, custom: 'Trendyol'})
                    .reply(200, fragmentContent);
                const fragment = new FragmentStorefront('product', 'test');
                fragment.update(commonFragmentConfig, 'http://local.gatewaysimulator.com');


                const content = await fragment.getContent({custom: 'Trendyol'});

                expect(content.html).to.deep.eq(fragmentContent);
            });

            it('should fetch the asset with the desired name', async () => {
                const productScript = `<script>console.log('Product Script')</script>`;

                const scope = nock('http://asset-serving-test.com')
                    .get('/product/static/bundle.min.js')
                    .reply(200, productScript);

                const fragment = new FragmentStorefront('product', 'test');

                let fragmentContent = {
                    ...commonFragmentConfig
                };
                fragmentContent.assets = [
                    {
                        fileName: 'bundle.min.js',
                        location: RESOURCE_LOCATION.HEAD,
                        name: 'product-bundle',
                        injectType: RESOURCE_INJECT_TYPE.EXTERNAL,
                        type: RESOURCE_TYPE.JS
                    }
                ];

                fragment.update(fragmentContent, 'http://asset-serving-test.com');

                const scriptContent = await fragment.getAsset('product-bundle');

                expect(scriptContent).to.eq(productScript);

            });
        });
    });
}