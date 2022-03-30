import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";
import hljs from "highlight.js";
import "highlight.js/styles/monokai.css";
import katex from "katex";
import "katex/dist/contrib/auto-render.min.js";
import "katex/dist/katex.min.css";
import { unescape } from "lodash";

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
                const html = toHtml(toHast(node)).replaceAll("&#x26;", "&");
                let rs = [];
                let lastFormula = [];
                let isDisplayMode = false;
                let enterFormula = false;

                for (let i = 0; i < html.length; i++) {
                    const char = html[i];
                    const nextChar = html[i + 1];
                    if (char === "$" && (i === 0 || char[i] !== "\\")) {
                        // edge check
                        if (!lastFormula.length) {
                            // formula start
                            if (isDisplayMode) {
                                // already has two $
                                rs.push(char);
                                isDisplayMode = false;
                                enterFormula = false;
                            } else if (
                                i < html.length - 1 &&
                                nextChar === "$"
                            ) {
                                isDisplayMode = true;
                                i++;
                                enterFormula = true;
                                continue;
                            } else {
                                enterFormula = true;
                            }
                        } else {
                            // formula end
                            if (!isDisplayMode) {
                                rs.push(
                                    katex.renderToString(lastFormula.join(""), {
                                        throwOnError: true,
                                    })
                                );
                                enterFormula = false;
                            } else if (
                                i < html.length - 1 &&
                                nextChar === "$"
                            ) {
                                rs.push(
                                    katex.renderToString(lastFormula.join(""), {
                                        displayMode: true,
                                        throwOnError: true,
                                    })
                                );
                            } else {
                                rs.push(lastFormula.join(""));
                            }
                            lastFormula = [];
                            isDisplayMode = false;
                            enterFormula = false;
                        }
                    } else if (enterFormula) {
                        // in formula
                        lastFormula.push(char);
                    } else {
                        // normal
                        rs.push(char);
                    }
                }
                return rs.join("");
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
                const lang = node.lang;
                if (lang === "mermaid") {
                    return AstUtils.toHtml(node);
                } else {
                    const code = lang
                        ? hljs.highlight(node.value, {
                              language: node.lang || "bash",
                          }).value
                        : hljs.highlightAuto(node.value).value;
                    return `<pre><code>${code}</code></pre>`;
                }
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
