class EventHub<P>
{
    public cbks=[];
    /**
     * register
     */
    public register(cbk:(pars:P)=>void) {
        this.cbks.push(cbk);
    }
    public send(pars:P)
    {
        this.cbks.forEach((v)=>{
            v(pars);
        });
    }
}
interface Message
{
    sender:string;
    data:any;
}
/**
 * 消息约定 *代表未知  sys代表系统
 */
class MessageHub
{
    public id_lst:string[]=[];
    //id->MessageClient
    public id_map={};
    constructor()
    {

    }
    public send(id:string,selfid:string,obj:any)
    {
        this.getClient(id).Source.send({
            sender:selfid,
            data:obj});
    }
    public getClient(id:string)
    {
        if(id in this.id_map) return this.id_map[id] as MessageClient;
        return null;
    }
    public register(client:MessageClient)
    {
        client.setCore(this);
        if(client.id in this.id_map) return false;
        this.id_lst.push(client.id);
        this.id_map[client.id]=client;
    }
}


/**
 * 端口
 */
class MessageClient
{
    constructor(public core:MessageHub,
                public id:string,
                public componentname:string="*",
                public groupid:string="*")
                {
                    this.sendids=core.id_lst;
                }
    
    protected sendids:Array<string>=null;
    public setCore(value:MessageHub)
    {
        this.core=value;
        this.sendids=this.core.id_lst;
    }
    /**
     * 直接调用等于广播消息
     * @param obj 发送的对象
     */
    public send<T>(obj:T)
    {
        this.sendids.forEach((value,idx)=>{
            this.core.send(value,this.id,obj);
        });
    }
    public group(groupid:string):Readonly<MessageClient>
    {
        let ret=new MessageClient(this.core,this.id,this.componentname,this.groupid);
        ret.sendids=this.sendids.filter((value,idx)=>{
            if(this.core.getClient(value).groupid==groupid) return true;
            return false;
        });
        return ret;

    }
    public component(componentname:string):Readonly<MessageClient>
    {
        let ret=new MessageClient(this.core,this.id,this.componentname,this.groupid);
        ret.sendids=this.sendids.filter((value,idx)=>{
            if(this.core.getClient(value).componentname==componentname) return true;
            return false;
        });
        return ret;
    }
    public ids(...ids:string[]):Readonly<MessageClient>
    {
        let ret=new MessageClient(this.core,this.id,this.componentname,this.groupid);
        //过滤不存在的
        ret.sendids=ids.filter((value,idx)=>{
            if(this.core.getClient(value)!=null) return true;
            return false;
        });;
        return ret;
    }
    public except(...ids:string[]):Readonly<MessageClient>
    {
        let ret=new MessageClient(this.core,this.id,this.componentname,this.groupid);
        //过滤不存在的
        ret.sendids=this.sendids.filter((value,idx)=>{
            //如果在排除列表
            if(ids.indexOf(value)!=-1) return false;
            return true;
        });;
        return ret;
    }
    public exceptSelf():Readonly<MessageClient>
    {
        return this.except(this.id);
    }
    public Source:EventHub<Message>=new EventHub<Message>();
    
}