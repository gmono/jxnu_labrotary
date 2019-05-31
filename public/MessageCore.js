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
//# sourceMappingURL=MessageCore.js.map