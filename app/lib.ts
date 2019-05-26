

type PreMiddleWareFactor=(modsign:string,text:string)=>(tree:PostHTMLTree)=>Promise<void>;
type RareMiddleWareFactor=(modsign:string,html:string,script:{allscripts:string})=>(tree:PostHTMLTree)=>Promise<void>;
declare interface Window
{
    pack(str:string,pre_middleware?:Array<PreMiddleWareFactor>,rare_middleware?:Array<RareMiddleWareFactor>,modsign?:string):Promise<{html:string,script:string,modsign:string}>;
    parser(html:string):Promise<PostHTMLNode[]>;
    render(ast:PostHTMLNode[]):string;
    posthtml:PostHtmlModule;
    treeapis:{ApiSet:(tree: any, traverse_method?: any) => void,ApiReset:(tree: any) => void};
    core:MessageHub;
}

//节点的可允许类型
type PostHTMLTreeNode=PostHTMLNode|string;
declare interface PostHtmlModule
{
    (plugins?:pluginFunc[]):PostHTML;
}
//直接修改ast
type pluginFunc=(ast:PostHTMLTree)=>void|Promise<void>;
declare interface PostHTML
{
    use(plg:pluginFunc):PostHTML;
    process(html:string):PostHTMLResult;
}
declare interface PostHTMLResult
{
    tree:PostHTMLTree;
    html:string;
    messages:any[];
}
declare interface PostHTMLNode
{
    tag:string;
    attrs?:object;
    content?:Array<PostHTMLTreeNode>;
}
//回调函数返回 同步或异步
type ASTCbkResult=PostHTMLTreeNode|PostHTMLTreeNode[];
//回调函数
type ASTCbk=(p:PostHTMLTreeNode)=>ASTCbkResult|Promise<ASTCbkResult>;
declare interface PostHTMLTree
{
    [index:number]:PostHTMLNode;
    length:number;
    walk(cb:ASTCbk):Promise<void>;
    match(exp:Array<PostHTMLNode>|PostHTMLNode,cb:ASTCbk):Promise<void>;
    messages:any[];
}