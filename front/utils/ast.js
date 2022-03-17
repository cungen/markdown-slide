import { get, last, memoize } from "lodash";
import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";

const types = {
    heading: "heading",
    list: "list",
    listItem: "listItem",
    p: "paragraph",
    text: "text",
};

const AstUtils = {
    isHeading: ({ type }) => type === types.heading,
    isList: ({ type }) => type === types.list,
    hasChild({ children = [] }) {
        return children.some(AstUtils.isNavigable);
    },
    isNavigable: memoize(function ({ children = [] }) {
        return (
            children.length > 0 &&
            (children.every(AstUtils.isHeading) ||
                children.every(AstUtils.isList))
        );
    }),
    toHtml(node) {
        if (node) {
            try {
                return toHtml(toHast(node));
            } catch (e) {
                console.log({ node }, e);
                return "";
            }
        }
        return "";
    },
    addParent(item) {
        if (item.children && item.children.length) {
            item.children.forEach((child) => {
                child.parent = item;
                AstUtils.addParent(child);
            });
        }
    },
    transformToSlideTree(astTree) {
        let slides = [];
        let stack = [];
        let children = [];
        if (get(astTree, "children.length")) {
            astTree.children.forEach((item) => {
                let lastStack = last(stack);
                if (AstUtils.isHeading(item)) {
                    if (!lastStack) {
                        // 无标题
                        if (children.length) {
                            // 但有内容，需要生成一个假标题来存内容
                            slides.push({
                                type: types.heading,
                                depth: 1,
                                title: "",
                                children,
                            });
                            children = [];
                        }
                        stack.push({
                            ...item,
                            html: AstUtils.toHtml(item),
                            title: AstUtils.toHtml(item.children[0]),
                            children,
                        });
                    } else {
                        // 有标题在栈中，但当前是父级标题
                        while (lastStack && lastStack.depth >= item.depth) {
                            const top = stack.pop();
                            lastStack = last(stack);
                            if (!stack.length) {
                                slides.push(top);
                            }
                        }
                        children = [];
                        const current = {
                            ...item,
                            html: AstUtils.toHtml(item),
                            title: item.children
                                ? AstUtils.toHtml(item.children[0])
                                : "",
                            children,
                        };
                        if (lastStack) {
                            lastStack.children.push(current);
                            lastStack = last(stack);
                        }
                        stack.push(current);
                    }
                } else {
                    children.push(item);
                }
            });
            if (stack[0]) {
                slides.push(stack[0]);
            } else if (children.length) {
                slides.push({
                    type: types.heading,
                    depth: 1,
                    title: "",
                    children,
                });
            }
        }
        const rs = {
            type: "root",
            children: slides,
        };
        AstUtils.addParent(rs);
        return rs;
    },
    navigateList: memoize(function ({ children }) {
        console.log(children);
        if (children.every(AstUtils.isHeading)) {
            return children.map((child) => {
                return AstUtils.toHtml({
                    type: types.text,
                    value: child.title,
                });
            });
        } else {
            // every is list
            const rs = [];
            children.forEach((list) => {
                (list.children || []).forEach((listItem) => {
                    (listItem.children || []).forEach((item) => {
                        if (!AstUtils.isList(item)) {
                            rs.push(AstUtils.toHtml(item));
                        }
                    });
                });
            });
            console.log(rs);
            return rs;
        }
    }),
    getHeadingChildren: memoize(function (node) {
        const children = node.children;
        if (children.length === 1 && AstUtils.isList(children[0])) {
            const list = children[0]; // list
            return AstUtils.toHtml({
                ...list,
                children: list.children.map((listItem) => {
                    return {
                        ...listItem,
                        children: (listItem.children || []).filter(
                            (item) => !AstUtils.isList(item)
                        ),
                    };
                }),
            });
        } else {
            return "";
        }
    }),
    getChildrenHtml(node) {
        const handlerMap = {
            [types.heading]: AstUtils.getHeadingChildren,
        };
        const handler = handlerMap[node.type];
        if (handler) {
            return handler(node);
        }
    },
};

export default AstUtils;
