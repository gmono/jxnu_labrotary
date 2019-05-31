class EventHub {
    constructor() {
        this.cbks = [];
    }
    /**
     * register
     */
    register(cbk) {
        this.cbks.push(cbk);
    }
    send(pars) {
        this.cbks.forEach((v) => {
            v(pars);
        });
    }
}
/**
 * 消息约定 *代表未知  sys代表系统
 */
class MessageHub {
    constructor() {
        this.id_lst = [];
        //id->MessageClient
        this.id_map = {};
    }
    send(id, selfid, obj) {
        this.getClient(id).Source.send({
            sender: selfid,
            data: obj
        });
    }
    getClient(id) {
        if (id in this.id_map)
            return this.id_map[id];
        return null;
    }
    register(client) {
        client.setCore(this);
        if (client.id in this.id_map)
            return false;
        this.id_lst.push(client.id);
        this.id_map[client.id] = client;
    }
}
let core = new MessageHub();
if (window.core != null)
    core = window.core;
/**
 * 端口
 */
class MessageClient {
    constructor(core, id, componentname = "*", groupid = "*") {
        this.core = core;
        this.id = id;
        this.componentname = componentname;
        this.groupid = groupid;
        this.sendids = null;
        this.Source = new EventHub();
        this.sendids = core.id_lst;
    }
    setCore(value) {
        this.core = value;
        this.sendids = this.core.id_lst;
    }
    /**
     * 直接调用等于广播消息
     * @param obj 发送的对象
     */
    send(obj) {
        this.sendids.forEach((value, idx) => {
            this.core.send(value, this.id, obj);
        });
    }
    group(groupid) {
        let ret = new MessageClient(this.core, this.id, this.componentname, this.groupid);
        ret.sendids = this.sendids.filter((value, idx) => {
            if (this.core.getClient(value).groupid == groupid)
                return true;
            return false;
        });
        return ret;
    }
    component(componentname) {
        let ret = new MessageClient(this.core, this.id, this.componentname, this.groupid);
        ret.sendids = this.sendids.filter((value, idx) => {
            if (this.core.getClient(value).componentname == componentname)
                return true;
            return false;
        });
        return ret;
    }
    ids(...ids) {
        let ret = new MessageClient(this.core, this.id, this.componentname, this.groupid);
        //过滤不存在的
        ret.sendids = ids.filter((value, idx) => {
            if (this.core.getClient(value) != null)
                return true;
            return false;
        });
        ;
        return ret;
    }
    except(...ids) {
        let ret = new MessageClient(this.core, this.id, this.componentname, this.groupid);
        //过滤不存在的
        ret.sendids = this.sendids.filter((value, idx) => {
            //如果在排除列表
            if (ids.indexOf(value) != -1)
                return false;
            return true;
        });
        ;
        return ret;
    }
    exceptSelf() {
        return this.except(this.id);
    }
}
//组件化基本程序
function getcode(txt) {
    let first = txt.indexOf("{");
    let last = txt.lastIndexOf("}");
    return txt.substring(first + 1, last);
}
/**
 * 调用代理工厂
 */
function getCallProxy(_this) {
    return (func) => (...args) => {
        return func.apply(_this, args);
    };
}
/**
 * 加载一个页面到节点中（页面包括html文本和script)
 * @param root 挂载的根节点
 * @param text html页面的文本
 * @param script html页面的script
 * @param modsign 用于表示此次加载的sign
 */
async function loadPage(root, text, script, modsign, name = "*", props = {}) {
    props = { ...props, root };
    root.innerHTML = text;
    //在html加载完成后执行的代码
    setTimeout(() => {
        let rootjq = $(root);
        //构造查询函数
        let jqfunc = (...args) => {
            return rootjq.find(...args);
        };
        //代理window对象
        let window_proxy = {
            onload: null
        };
        let pwindow = new Proxy(window, {
            get(target, p, receiver) {
                if (p in window_proxy)
                    return window_proxy[p];
                return target[p];
            },
            set(target, p, value, receiver) {
                //置换各种事件
                if (p in window_proxy)
                    window_proxy[p] = value;
                else {
                    console.log("组件尝试非法写入");
                    return false;
                }
                return true;
            }
        });
        //构造部分只读和代理的document 以下函数都会被在document上调用
        const document_proxy = {
            getElementById(id) {
                return pars.$(`#${id}`)[0];
            },
            createElement(tagname) {
                let ele = document.createElement(tagname);
                //添加组件标志
                ele.setAttribute("data-sign", modsign);
                return ele;
            }
        };
        const document_call_proxy = getCallProxy(document);
        //代理文档
        let pdocument = new Proxy(document, {
            get(target, p, receiver) {
                //如果p在root节点上有 比如query等 则直接返回
                if (p in root) {
                    if (root[p] instanceof Function)
                        return (...args) => root[p](...args);
                    return root[p];
                }
                else if (p in document_proxy) {
                    //如果document代理上有优先使用代理函数
                    if (document_proxy[p] instanceof Function)
                        return document_call_proxy(document_proxy[p]);
                    else
                        return document_proxy[p];
                }
                else
                    return target[p];
            },
            set(target, p, value, receiver) {
                console.log("组件尝试非法写入");
                return true;
            }
        });
        //页面主函数参数
        //这里jq和document创建节点时放上sign
        let client = new MessageClient(core, modsign, name);
        core.register(client);
        let pars = {
            $: jqfunc,
            window: pwindow,
            document: pdocument,
            msghub: client
        };
        //执行代码
        let evalfunc = ({ $, window, document, msghub }) => {
            eval(script);
        };
        evalfunc(pars);
        //处理后续操作（触发各种事件等）
        //调用onload
        setTimeout((() => {
            let { $, window, document, msghub } = pars;
            window_proxy.onload && window_proxy.onload();
        }), 0);
    }, 0);
}
//得到容器
function getContainer(root) {
    let cont = document.createElement("div");
    cont.style.position = "relative";
    cont.style.height = cont.style.width = "100%";
    root.appendChild(cont);
    return cont;
}
//自定义的组件加载
function getTrans(baseurl = new URL(window.location.href).pathname) {
    let compsum = 0;
    let compontentTrans = (modsign, text) => async (tree) => {
        window.treeapis.ApiSet(tree, "first");
        await tree.match({ tag: "component" }, (p) => {
            if (typeof p == "string")
                return p;
            let src = p.attrs["src"];
            //执行代码得到对象
            let propscode = "{}";
            if ("props" in p.attrs)
                propscode = p.attrs["props"];
            src = join(baseurl, src);
            console.log(src);
            p.tag = "div";
            p.attrs["id"] = `__component__${compsum}`;
            let script = {
                tag: "script",
                attrs: [],
                content: [`loadFile(document.getElementById("__component__${compsum}"),"${src}",${propscode});`]
            };
            compsum++;
            return [p, script];
        });
    };
    return compontentTrans;
}
/**
 * 加载文件到节点中作为组件
 * @param root 加载的根节点
 * @param url 加载的文件路径
 * @param props 组件属性对象（在组件内以props引用）
 * @param mdsign 自定义组件标识，用于纯粹内容加载时提供相同的sign或者对特殊部件提供特定的sign做id
 */
async function loadFile(root, url, props = {}, mdsign = null) {
    //处理root 取得相对容器
    root = getContainer(root);
    let ele = root;
    let res = await fetch(url);
    if (res.ok) {
        let text = await res.text();
        //处理
        let { html, script, modsign } = await (mdsign == null ? window.pack(text, [getTrans()]) : window.pack(text, [getTrans()], [], mdsign));
        loadPage(ele, html, script, modsign, url, props);
        return modsign;
    }
    return null;
}
//# sourceMappingURL=test.js.map