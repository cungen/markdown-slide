<template lang="pug">
.app-container.theme-dark
    .slide-container(v-if='root && root.children.length' :class='[operateClass]')
        .slide
            .heading(v-if='title' v-html='title')
            .content(v-if='isCode(currentNode) || isImage(currentNode) || isParagraph(currentNode)')
                div(v-html='getNodeHtml(currentNode)')
            .content(v-else)
                ul
                    li(
                        v-for='(child, cIndex) in currentChildren'
                        :key='cIndex'
                        v-html='getNodeHtml(child)'
                    )
        .navigator
            NIcon.left(size='16px' :class='{ disabled: !hasParent }'): CaretLeft
            NIcon.up(size='16px' :class='{ disabled: !hasPrev }'): CaretUp
            NIcon.right(size='16px' :class='{ disabled: !hasChild }'): CaretRight
            NIcon.down(size='16px' :class='{ disabled: !hasNext }'): CaretDown
        //- .pager {{ path.map(i => i + 1).join('.') }} / {{ get(root, 'children.length') }}

    .slide-container(v-else)
        .no-data 暂无内容

</template>

<script>
import { defineComponent, ref } from "vue";
import { findIndex, get, last, pick } from "lodash";
import { fromMarkdown } from "mdast-util-from-markdown";
import { transform } from "markdown-ast-to-tree";
import {
    NIcon,
    NRadioGroup,
    NRadioButton,
    NDatePicker,
    NSpace,
} from "naive-ui";
import { CaretLeft, CaretUp, CaretRight, CaretDown } from "@vicons/fa";
import content from "./data/mock";
import AstUtils from "./utils/ast";

export default defineComponent({
    components: {
        NIcon,
        NRadioGroup,
        NRadioButton,
        NDatePicker,
        NSpace,
        CaretLeft,
        CaretUp,
        CaretRight,
        CaretDown,
    },
    data() {
        return {
            root: null,
            path: [],
            parents: [],
            operateClass: "",
            activeChildIndex: 0,
        };
    },
    computed: {
        hasParent() {
            return this.parents.length > 1;
        },
        hasPrev() {
            return this.currentNodeIndex > 0;
        },
        hasChild() {
            return (
                (this.currentNode.children || []).some((child) => {
                    return child.children.length > 0;
                }) ||
                (this.currentNode.children > 1 &&
                    (this.currentNode.children || []).some(
                        (child) => this.isCode(child) || this.isImage(child)
                    ))
            );
        },
        hasNext() {
            if (this.parentNode) {
                return (
                    this.currentNodeIndex < this.parentNode.children.length - 1
                );
            }
            return false;
        },
        parentNode() {
            if (this.parents.length > 1) {
                const parent = this.parents[this.parents.length - 2];
                if (this.needSkip(parent)) {
                    return this.parents[this.parents.length - 3];
                } else {
                    return parent;
                }
            }
            return null;
        },
        currentNodeIndex() {
            if (this.parentNode) {
                return findIndex(this.parentNode.children, (child) => {
                    if (this.needSkip(child)) {
                        return child.children[0] === this.currentNode;
                    } else {
                        return child === this.currentNode;
                    }
                });
            }
            return 0;
        },
        currentNode() {
            return last(this.parents);
        },
        currentChildren() {
            return this.currentNode.children || [];
        },
        title() {
            return this.parents
                .filter(this.isHeading)
                .map((item) => this.toHtml(item.node))
                .join(" / ");
        },
    },
    created() {
        window.addEventListener("message", (event) => {
            const message = event.data;
            switch (message.command) {
                case "content":
                    console.log("vue on msg", message.data);
                    this.init(message.data);
                    break;
            }
        });
    },
    async mounted() {
        this.init(content);
        window.addEventListener("keydown", this.handleKeyDown);
    },
    beforeUnmount() {
        window.removeEventListener("keydown", this.handleKeyDown);
    },
    methods: {
        get: get,
        last: last,
        ...pick(AstUtils, [
            "isHeading",
            "isList",
            "isListItem",
            "isCode",
            "isImage",
            "isParagraph",
            "toHtml",
            "getNodeHtml",
        ]),
        init(content) {
            this.root = transform(fromMarkdown(content));
            this.parents = [this.root];
        },
        handleKeyDown(e) {
            switch (e.keyCode) {
                case 37: // left
                    if (this.hasParent) {
                        this.popToParent();
                    }
                    this.operateClass = "left";
                    break;
                case 38: // top
                    if (this.hasPrev) {
                        const prevNode =
                            this.parentNode.children[this.currentNodeIndex - 1];
                        this.popToParent();
                        this.parents.push(prevNode);
                    }
                    this.doSkipIfNeeded();
                    this.operateClass = "";
                    break;
                case 39: // right
                    if (this.hasChild) {
                        this.parents.push(this.currentChildren[0]);
                    }
                    this.doSkipIfNeeded();
                    this.operateClass = "right";
                    break;
                case 40: // bottom
                case 32: // blank
                case 13: // enter
                    if (this.hasNext) {
                        const nextNode =
                            this.parentNode.children[this.currentNodeIndex + 1];
                        this.popToParent();
                        this.parents.push(nextNode);
                    }
                    this.doSkipIfNeeded();
                    this.operateClass = "";
                    break;
            }
        },
        popToParent() {
            this.parents.pop();
            if (this.needSkip(this.currentNode)) {
                this.parents.pop();
            }
        },
        // heading with only one child can be skip
        needSkip(node) {
            return (
                (node.children || []).length === 1 &&
                (this.isHeading(node) || this.isListItem(node))
            );
        },
        doSkipIfNeeded() {
            if (this.needSkip(this.currentNode)) {
                this.parents.push(this.currentChildren[0]);
            }
        },
    },
});
</script>

<style lang="sass">
*
    box-sizing: border-box
html
    font-size: 100px
body
    -webkit-font-smoothing: antialiased
    -moz-osx-font-smoothing: grayscale
    margin: 0
    line-height: 1.3
html, body, #app
    display: flex
    flex: 1
    width: 100%
    height: 100%
    overflow: hidden

h1, h2, h3, h4, h5, h6
    font-weight: 500
    display: block
h1
    font-size: 0.52rem
    font-weight: 600
h2
    font-size: 0.48rem
h3
    font-size: 0.42rem
h4
    font-size: 0.38rem
h5
    font-size: 0.32

.slide-container
    .title
        h1, h2, h3, h4, h5, h6
            font-size: 0.32rem
            padding: 0 8px
    .content
        h1, h2, h3, h4, h5, h6
            font-size: 0.24rem
            font-weight: 500
            padding: 0 0.24rem
            text-align: left
    ul, ol
        width: 100%
        font-size: 0.32rem
        ul, ol
            padding: 0.24rem 0.32rem
        li
            margin-bottom: 0.14rem
            transition: font-size 400ms, color 400ms
            code
                max-height: 30vh

    li.active
        color: #18a058
        font-weight: 500
        font-size: 0.36rem
    pre
        margin: 0
        padding: 0.04rem .12rem
        border-radius: 0.08rem
        background: rgba(#fff, 0.05)
        code
            line-height: 1.15
            font-size: 0.24rem
            max-height: 50vh

// Theme
.theme-dark
    .slide-container
        background: #222
        color: #eee
    .pager
        color: #eee
    a
        color: #eee
        font-style: underline

// Transition
.slide
    &.active
        left: 0
        top: 0
        bottom: 0
    &.before
        top:  -100vh
        bottom: 100vh
    &.after
        top: 100vh
        bottom: -100vh
.slide-container.left
    &.before
        left: -100vw
    &.after
        left: 100vw
.slide-container.right
    &.before
        left: 100vw
    &.after
        left: -100vw

.app-container
    display: flex
    flex: 0 0 100%
    width: 100%
    flex-direction: column
    color: #2c3e50
    overflow: hidden
.slide-container
    display: flex
    flex: 1
    justify-content: center
    align-items: center
    overflow: hidden

.navigator
    .left, .up, .right, .down
        color: #ccc
        &.disabled
            color: #666
.pager
    position: absolute
    left: 20px
    bottom: 20px
.navigator
    position: absolute
    bottom: 20px
    right: 20px
    width: 40px
    height: 40px
    .left
        position: absolute
        left: 0
        top: 50%
        transform: translate(0, -50%)
    .right
        position: absolute
        right: 0
        top: 50%
        transform: translate(0, -50%)
    .up
        position: absolute
        top: 0
        left: 50%
        transform: translate(-50%, 0)
    .down
        position: absolute
        bottom: 0
        left: 50%
        transform: translate(-50%, 0)
.slide
    position: absolute
    min-width: 100%
    min-height: 100%
    display: flex
    justify-content: center
    flex-direction: column
    overflow: hidden
    font-size: 0.24rem
    transition: left 400ms, top 400ms, right 400ms, bottom 400ms
    .heading
        display: flex
        flex: 0 0 auto
        align-items: center
        justify-content: center
        font-size: 0.36rem
        font-weight: 500
        padding: 0.32rem 0 0.24rem
        opacity: 0.8
    .content
        display: flex
        justify-content: center
        flex: 1
        overflow: auto
        padding: 0 0.4rem
        flex-direction: column
    .title + .content
        text-align: left
        font-size: 28px
</style>
