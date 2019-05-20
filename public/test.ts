class MessageHub
{

}
//jq函数声明
// type JQFunc<TElement=HTMLElement>=(selector_elements_selection_function:
//     JQuery.Selector |
//     JQuery.TypeOrArray<Element> |
//     JQuery |
//     ((this: TElement, index: number, element: TElement) => boolean)
// )=> JQuery<any>;
type JQFunc<TElement=HTMLElement>=(selector?:JQuery.Selector)=>JQuery<TElement>;
type LoadJSFunc=(url:string)=>Promise<any>;
interface PageFuncPars
{
    $:JQFunc;
    window:Window;
    document:Document;
    msghub:MessageHub;
}
type PageFunc=(pars:PageFuncPars)=>Promise<void>;
//组件化基本程序

function getcode(txt:string)
{
    let first=txt.indexOf("{");
    let last=txt.lastIndexOf("}");
    return txt.substring(first+1,last);
}
/**
 * 
 * @param root 挂载的根节点
 * @param text html页面的文本
 * @param script html页面的script
 * @param modsign 用于表示此次加载的sign
 */
async function loadPage(root:HTMLElement,text,script,modsign:string)
{
    root.innerHTML=text;
    //在html加载完成后执行的代码
    setTimeout(()=>{
        
        let rootjq=$(root);
        //构造查询函数
        let jqfunc:JQFunc=(...args)=>{
            return rootjq.children(...args);
        };
        //构造只读的window 并代理各种事件
        let onload;
        let pwindow=new Proxy(window,{
            get(target,p,receiver){
                return target[p];
            },
            set(target,p,value,receiver){
                //置换各种事件
                if(p=="onload") onload=value;
                console.log("组件尝试非法写入");
                return true;
            }

        });
        //构造部分只读和代理的document 以下函数都会被在document上调用
        const document_proxy={
            getElementById(this:Document,id){
                return pars.$(`#${id}`)[0];
            },
            createElement(tagname){
                let ele=document.createElement(tagname) as HTMLElement;
                //添加组件标志
                ele.setAttribute("data-sign",modsign);
                return ele;
            }
        }
        //调用代理
        const call_proxy=(func:Function)=>(...args)=>{
            return func.apply(document,args);
        }
        //代理文档
        let pdocument=new Proxy(document,{
            get(target,p,receiver){
                //如果p在root节点上有 比如query等 则直接返回
                if(p in root) 
                {
                    if(root[p] instanceof Function) return (...args)=>root[p](...args);
                    return root[p];
                }
                else if (p in document_proxy)
                {
                    //如果document代理上有优先使用代理函数
                    if(document_proxy[p] instanceof Function) return call_proxy(document_proxy[p]);
                    else return document_proxy[p];
                }
                else return target[p];
            },
            set(target,p,value,receiver){
                console.log("组件尝试非法写入");
                return true;
            }
        });
        //页面主函数参数
        //这里jq和document创建节点时放上sign
        let pars:PageFuncPars={
            $:jqfunc,
            window:pwindow,
            document:pdocument,
            msghub:new MessageHub()
        };
        //合成代码
        let evalfunc=({$,window,document,msghub})=>{
            eval(script);
        };
        evalfunc(pars);
        //调用onload
        setTimeout((()=>{
            let {$,window,document,msghub}=pars;
            onload&&onload();
        }),0);
    },0);
}
//得到容器
function getContainer(root)
{
    let cont=document.createElement("div");
    cont.style.position="relative";
    cont.style.height=cont.style.width="100%";

    root.appendChild(cont);
    return cont;
}
async function loadFile(root:HTMLElement,url)
{
    //处理root 取得相对容器
    root=getContainer(root);
    let ele=root;
    let res=await fetch(url);
    if(res.ok)
    {
        let text=await res.text();
        //处理
        let {html,script,modsign}=await window.pack(text);
        loadPage(ele,html,script,modsign);
    }
}
loadFile($("div")[0],"./page1.html");
loadFile($("div")[1],"./page2.html");
loadFile($("#anpage1")[0],"./page1.html");
loadFile($("#anpage2")[0],"./page1.html");