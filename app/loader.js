"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const posthtml = require("posthtml");
const parser = require("posthtml-parser");
const render = require("posthtml-render");
let html = posthtml;
const getRandomStr = () => Math.random().toString(36).substr(2);
const posthtml_api_1 = require("./posthtml_api");
const postcss = require("postcss");
function isBrowser() {
    try {
        window && window instanceof Window;
        return true;
    }
    catch (e) {
        return false;
    }
}
//加载文件
async function loadTxt(url) {
    if (isBrowser()) {
        try {
            let res = await fetch(url);
            if (res.ok) {
                let txt = await res.text();
                return txt;
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    else {
        let fs = require("./async_node");
        let txt = await fs.readAsync(url, "utf-8");
        return txt;
    }
}
function deleteContainer(expression) {
    //删除容器释放内容物
    return async (tree) => {
        posthtml_api_1.ApiSet(tree, "last");
        await tree.match(expression, (p) => {
            if (typeof p == "object")
                return p.content;
            else
                return p;
        });
        posthtml_api_1.ApiReset(tree);
    };
}
function deleteElement(expression) {
    //直接删除节点
    return async (tree) => {
        posthtml_api_1.ApiSet(tree, "last");
        await tree.match(expression, (p) => {
            if (typeof p == "string")
                return p;
            else
                return [];
        });
        posthtml_api_1.ApiReset(tree);
    };
}
function getSignCssFunc(sign) {
    const signCss = async (tree) => {
        //处理所有style标签内的css
        posthtml_api_1.ApiSet(tree);
        let modsign = sign;
        await tree.match({ tag: "style" }, async (p) => {
            if (typeof p == "string")
                return p;
            let css = await postcss().use((root) => {
                root.walkRules((selector, idx) => {
                    //处理css选择器
                    selector.selectors = selector.selectors.map((value, idx) => {
                        return `${value}[data-sign="${modsign}"]`;
                    });
                    return selector;
                });
            }).process(p.content).css;
            p.content = [css];
            return p;
        });
        posthtml_api_1.ApiReset(tree);
    };
    return signCss;
}
const deleteDocType = async (tree) => {
    await tree.walk((p) => {
        if (typeof p == "string" && p.trim().toLowerCase().startsWith("<!doctype")) {
            return "";
        }
        return p;
    });
};
function getGatcherOfScripts() {
    let scriptContainer = { allscripts: "" };
    const gatherScripts = async (tree) => {
        //收集所有script标签 （按从上到下 后序遍历收集)
        //并删除标签
        posthtml_api_1.ApiSet(tree, "last");
        let allscripts = "";
        await tree.match({ tag: "script" }, (p) => {
            //得到代码
            if (typeof p == "string")
                return p;
            //提示专用的script引入
            if ("declare" in p.attrs)
                return [];
            let script = p.content;
            allscripts += "\n" + script;
            //清除script标签
            return [];
        });
        //保存到容器
        scriptContainer.allscripts = allscripts;
        posthtml_api_1.ApiReset(tree);
    };
    return { scriptContainer, gatherScripts };
}
async function pack(str) {
    let ret;
    let modsign = getRandomStr();
    let { gatherScripts, scriptContainer } = getGatcherOfScripts();
    let h = await html([posthtml_api_1.ApiRecord])
        .use(deleteDocType)
        .use((tree) => {
        //给所有标签打上模块sign
        tree.walk(cb => {
            if (typeof cb == "string")
                return cb;
            if (cb.attrs == null)
                cb.attrs = [];
            cb.attrs[`data-sign`] = modsign;
            return cb;
        });
        tree.messages.push({ modsign: modsign });
    })
        .use(async (tree) => {
        posthtml_api_1.ApiSet(tree);
        //将所有的link进来的css文件都加载到内置标签中
        await tree.match({ tag: "link" }, async (p) => {
            if (typeof p == "string")
                return p;
            if ("rel" in p.attrs && p.attrs["rel"] == "stylesheet") {
                let href = p.attrs["href"];
                //加载链接内容
                let txt = await loadTxt(href);
                if (txt == null)
                    return [];
                else {
                    p.tag = "style";
                    p.attrs = {};
                    p.content = [txt];
                }
            }
            return p;
        });
        posthtml_api_1.ApiReset(tree);
    }).use(async (tree) => {
        //把所有外部script引入内部
        posthtml_api_1.ApiSet(tree);
        await tree.match({ tag: "script" }, async (p) => {
            if (typeof p == "string")
                return p;
            if ("src" in p.attrs) {
                let src = p.attrs["src"];
                let txt = await loadTxt(src);
                if (txt == null)
                    return [];
                else {
                    delete p.attrs["src"];
                    p.content = [txt];
                }
            }
            return p;
        });
        posthtml_api_1.ApiReset(tree);
    })
        .use(deleteContainer([{ tag: "html" }, { tag: "body" }, { tag: "head" }]))
        .use(deleteElement([{ tag: "meta" }, { tag: "title" }]))
        .use(getSignCssFunc(modsign))
        .use(gatherScripts)
        .process(str);
    //调试
    console.log(h.html, scriptContainer.allscripts);
    //提取html中的script和普通标签
    return { html: h.html, script: scriptContainer.allscripts };
}
;
window.pack = pack;
window.parser = parser;
window.render = render;
window.posthtml = html;
//# sourceMappingURL=loader.js.map