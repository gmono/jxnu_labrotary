/**
 * index页的js文件
 */
let a = 1;
d3.select("svg").style("height", "100vh")
    .style("width", "100%");
d3.timer((e) => {
    d3.selectAll($("circle").toArray()).transition().duration(200).attr("r", a++);
    d3.select("svg").transition().duration(200).style("background-color", `rgb(${a / 2},${a / 1.8},${a / 1.5})`);
});
//# sourceMappingURL=index.js.map