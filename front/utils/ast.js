import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";
import katex from "katex";
import "katex/dist/katex.min.css";
import hljs from "highlight.js";
import "highlight.js/styles/monokai.css";

const types = {
    heading: "heading",
    list: "list",
    listItem: "listItem",
    p: "paragraph",
    text: "text",
    image: "image",
    code: "code",
    link: "link",
};

const AstUtils = {
    isHeading: ({ type }) => type === types.heading,
    isList: ({ type }) => type === types.list,
    isListItem: ({ type }) => type === types.listItem,
    isParagraph: ({ type }) => type === types.p,
    isCode: ({ type }) => type === types.code,
    isImage: ({ type }) => type === types.image,
    toHtml(node) {
        if (node) {
            try {
                const html = toHtml(toHast(node));
                return html.replace(/\$\$[^$]*\$\$|\$[^$]*\$/, (match) => {
                    return katex.renderToString(
                        match.replace(/^\$+|\$+$/g, ""),
                        {
                            displayMode:
                                match.startsWith("$$") && match.endsWith("$$"),
                            throwOnError: false,
                        }
                    );
                });
            } catch (e) {
                console.log({ node }, e);
                return "";
            }
        }
        return "";
    },
    getNodeHtml(node) {
        const handlerMap = {
            [types.heading]: (item) => AstUtils.toHtml(item.node),
            [types.listItem]: (item) => AstUtils.toHtml(item.node),
            [types.list]: ({ children }) =>
                children
                    .map(
                        (listItem) =>
                            "<div>" + AstUtils.toHtml(listItem.node) + "</div>"
                    )
                    .join(""),
            [types.code]: (node) => {
                return (
                    "<pre><code>" +
                    hljs.highlight(node.value, { language: node.lang }).value +
                    "</code></pre>"
                );
            },
        };
        const handler = handlerMap[node.type];
        if (handler) {
            return handler(node);
        } else {
            return AstUtils.toHtml(node);
        }
    },
};

export default AstUtils;
