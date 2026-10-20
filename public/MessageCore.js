"use strict";
class EventHub {
    cbks = [];
    /**
     * register
     */
    register(cbk) {
        this.cbks.push(cbk);
        return () => this.unregister(cbk);
    }
    unregister(cbk) {
        this.cbks = this.cbks.filter(registered => registered !== cbk);
    }
    clear() {
        this.cbks = [];
    }
    send(pars) {
        this.cbks.forEach((v) => {
            v(pars);
        });
    }
}
/**
 * 组 id和组件名约定 *代表未知  sys代表系统 其他自定义
 */
class MessageHub {
    id_lst = [];
    //id->MessageClient
    id_map = {};
    constructor() {
    }
    send(id, selfid, obj) {
        const client = this.getClient(id);
        if (!client)
            return false;
        client.Source.send({
            sender: selfid,
            typeid: "custom",
            data: obj
        });
        return true;
    }
    getClient(id) {
        if (id in this.id_map)
            return this.id_map[id];
        return null;
    }
    register(client) {
        if (client.id in this.id_map)
            return false;
        client.Core = this;
        this.id_lst.push(client.id);
        this.id_map[client.id] = client;
        return true;
    }
    unregister(id) {
        const client = this.getClient(id);
        if (!client)
            return false;
        client.Source.clear();
        delete this.id_map[id];
        this.id_lst = this.id_lst.filter(clientId => clientId !== id);
        return true;
    }
}
/**
 * 基本Message客户端，只负责传递消息，不解释data的含义
 * 提供基本的对特定组件/组/id 发送消息的功能
 * 提供组件自身的基本信息 包括自身的id 组件name 和组id
 * 允许客户端获取只读Core对象并使用其与全局交互
 */
class MessageClient {
    core;
    id;
    componentname;
    groupid;
    constructor(core, id, componentname = "*", groupid = "*") {
        this.core = core;
        this.id = id;
        this.componentname = componentname;
        this.groupid = groupid;
        this.sendids = core.id_lst;
    }
    sendids = null;
    set Core(value) {
        this.core = value;
        this.sendids = this.core.id_lst;
    }
    get Core() {
        return this.core;
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
    /**
     * 事件Hub 允许组件监听事件
     */
    Source = new EventHub();
    dispose() {
        return this.core.unregister(this.id);
    }
}
//# sourceMappingURL=MessageCore.js.map