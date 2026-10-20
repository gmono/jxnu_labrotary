'use strict'

/**
 * # API
 *
 * @author Ivan Voischev (@voischev),
 *         Anton Winogradov (@awinogradov),
 *         Alexej Yaroshevich (@zxqfox),
 *         Vasiliy (@Yeti-or)
 *
 * @namespace tree
 */
function Api () {
  this.walk = walk
  this.match = match
}

const treeState = new WeakMap<PostHTMLTree, { match: PostHTMLTree["match"]; walk: PostHTMLTree["walk"]; traverse: typeof traverse_first }>();

export function ApiRecord(tree:PostHTMLTree)
{
  if (!treeState.has(tree)) treeState.set(tree, { match: tree.match, walk: tree.walk, traverse: traverse_first });
}
const mapMethods={
  first:traverse_first,
  layer:traverse_layers,
  last:traverse_last
}
export type TraverseMethod="first"|"layer"|"last";
/**
 * 替换tree上的match和walk函数 添加async支持
 * @param tree 需要置换api的树对象
 * @param traverse_method 需要使用的遍历方法
 */
export function ApiSet(tree:PostHTMLTree,traverse_method:TraverseMethod="first")
{
    const state = treeState.get(tree);
    if (!state) throw new Error("PostHTML tree must be recorded before replacing its API");
    tree.match=match;
    tree.walk=walk;
    state.traverse=mapMethods[traverse_method];
}

export function ApiReset(tree:PostHTMLTree)
{
  const state=treeState.get(tree);
  if (!state) return;
  tree.walk=state.walk;
  tree.match=state.match;
}

/**
 * Walks the tree and passes all nodes via a callback
 *
 * @memberof tree
 *
 * @param  {Function} cb  Callback
 * @return {Function}     Callback(node)
 *
 *@example
 * ```js
 * export const walk = (tree) => {
 *   tree.walk((node) => {
 *     let classes = node.attrs && node.attrs.class.split(' ') || []
 *
 *     if (classes.includes(className)) return cb(node)
 *       return node
 *   })
 * }
 * ```
 */
async function walk (cb) {
  return await (treeState.get(this)?.traverse ?? traverse_first)(this, cb)
}

/**
 * Matches an expression to search for nodes in the tree
 *
 * @memberof tree
 *
 * @param  {String|RegExp|Object|Array} expression - Matcher(s) to search
 * @param  {Function} cb Callback
 *
 * @return {Function} Callback(node)
 *
 * @example
 * ```js
 * export const match = (tree) => {
 *   // Single matcher
 *   tree.match({ tag: 'custom-tag' }, (node) => {
 *     let tag = node.tag
 *
 *     Object.assign(node, { tag: 'div', attrs: {class: tag} })
 *
 *     return node
 *   })
 *   // Multiple matchers
 *   tree.match([{ tag: 'b' }, { tag: 'strong' }], (node) => {
 *     let style = 'font-weight: bold;'
 *
 *     node.tag = 'span'
 *
 *     node.attrs
 *       ? ( node.attrs.style
 *         ? ( node.attrs.style += style )
 *         : node.attrs.style = style
 *       )
 *       : node.attrs = { style: style }
 *
 *     return node
 *   })
 * }
 * ```
 */
async function match (expression, cb) {
  const traverse=treeState.get(this)?.traverse ?? traverse_first;
  return Array.isArray(expression)
    ? await traverse(this, function (node) {
      for (var i = 0; i < expression.length; i++) {
        if (compare(expression[i], node)) return cb(node)
      }

      return node
    })
    : await traverse(this, function (node) {
      if (compare(expression, node)) return cb(node)

      return node
    })
}

/**
 * Checks if parameter is a Promise (or thenable) object.
 *
 * @private
 *
 * @param   {*} promise - Target `{}` to test
 * @returns {Boolean}
 */
function isPromise (promise) {
    return !!promise && typeof promise.then === 'function'
}



/** 
 * @private 
 * 扫描遍历树 前序遍历
 * */
async function traverse_first (tree, cb) {
  if (Array.isArray(tree)) {
    let newtree=[];
    for(var i = 0; i < tree.length; i++) 
    {
      //此处判断是否异步 异步则等待
      let res=cb(tree[i]);
      if(isPromise(res)) res=await res;
      //此处判断是否数组 数组则表示使用一系列node|string替换那一位置的node
      //如果res为数组 则直接处理原数组（否则处理原节点。的content）
      //此处为深度优先遍历
      let ret=await traverse_first(res, cb)
      if(Array.isArray(ret))
      {
        //原位替换
        newtree=newtree.concat(ret);
      }
      else newtree.push(ret);
    }
    //替换原树
    tree.splice(0,tree.length,...newtree);
  } else if (
      tree &&
      typeof tree === 'object' &&
      tree.hasOwnProperty('content')
  ) await traverse_first(tree.content, cb)

  return tree
}

/** 
 * @private 
 * 扫描遍历树 后序遍历
 * */
async function traverse_last (tree, cb) {
  if (Array.isArray(tree)) {
    let newtree=[];
    for(var i = 0; i < tree.length; i++) 
    {
      //后续遍历 先处理tree[i]的content 此处返回处理过的tree[i]
      let ret=await traverse_last(tree[i], cb)
      //使用回调函数处理 已经处理过content的node
      let res=cb(ret);
      if(isPromise(res)) res=await res;
      if(Array.isArray(res))
      {
        //原位替换
        newtree=newtree.concat(res);
      }
      else newtree.push(res);
    }
    //替换原树
    tree.splice(0,tree.length,...newtree);
  } else if (
      tree &&
      typeof tree === 'object' &&
      tree.hasOwnProperty('content')
  ) await traverse_last(tree.content, cb)

  return tree
}

/**
 * 层次遍历
 * @param tree 树
 * @param cb 回调函数
 */
async function traverse_layers (tree, cb) {
  if (Array.isArray(tree)) {
    let newtree=[];
    for(let node of tree) 
    {
      //此处判断是否异步 异步则等待
      let res=cb(node);
      if(isPromise(res)) res=await res;
      //此处判断是否数组 数组则表示使用一系列node|string替换那一位置的node
      //如果res为数组 则直接处理原数组（否则处理原节点。的content）
      //此处为深度优先遍历
      //改为层次遍历
      // let ret=await traverse(res, cb)
      if(Array.isArray(res))
      {
        //原位替换
        newtree=newtree.concat(res);
      }
      else newtree.push(res);
    }
    //替换原树
    tree.splice(0,tree.length,...newtree);
    //进行下一层扫描
    for(let node of tree)
    {
      //处理每个新生成的这层的节点的下一层
      await traverse_layers(node,cb);
    }

  } else if (
      tree &&
      typeof tree === 'object' &&
      tree.hasOwnProperty('content')
  ) await traverse_layers(tree.content, cb)

  return tree
}
/**
 *  @private
 * 用于比较expression和节点是否匹配
 * 后期可以改为使用css选择器或xpath进行匹配
 */
function compare (expected, actual) {
  if (expected instanceof RegExp) {
    if (typeof actual === 'object') return false
    if (typeof actual === 'string') return expected.test(actual)
  }

  if (typeof expected !== typeof actual) return false
  if (typeof expected !== 'object' || expected === null) {
    return expected === actual
  }

  if (Array.isArray(expected)) {
    return expected.every(function (exp) {
      return [].some.call(actual, function (act) {
        return compare(exp, act)
      })
    })
  }

  return Object.keys(expected).every(function (key) {
    var ao = actual[key]
    var eo = expected[key]

    if (typeof eo === 'object' && eo !== null && ao !== null) {
      return compare(eo, ao)
    }
    if (typeof eo === 'boolean') {
      return eo !== (ao == null)
    }

    return ao === eo
  })
}
