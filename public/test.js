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
 *
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
        //构造只读的window 并代理各种事件
        let onload;
        let pwindow = new Proxy(window, {
            get(target, p, receiver) {
                return target[p];
            },
            set(target, p, value, receiver) {
                //置换各种事件
                if (p == "onload")
                    onload = value;
                console.log("组件尝试非法写入");
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
        //调用代理
        const call_proxy = (func) => (...args) => {
            return func.apply(document, args);
        };
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
                        return call_proxy(document_proxy[p]);
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
        //合成代码
        let evalfunc = ({ $, window, document, msghub }) => {
            eval(script);
        };
        evalfunc(pars);
        //调用onload
        setTimeout((() => {
            let { $, window, document, msghub } = pars;
            onload && onload();
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
async function loadFile(root, url, props = {}) {
    //处理root 取得相对容器
    root = getContainer(root);
    let ele = root;
    let res = await fetch(url);
    if (res.ok) {
        let text = await res.text();
        //处理
        let { html, script, modsign } = await window.pack(text);
        loadPage(ele, html, script, modsign, url, props);
    }
}
//# sourceMappingURL=test.js.map