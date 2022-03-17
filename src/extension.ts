// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { readdirSync } from "fs";
import * as path from "path";
import { isMarkdownFile, MarkdownSlideView } from "./slide-content-provider";
import { assetsPath, getDiskPath, getWebviewContent } from "./util";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // assume only one preview supported.
    const contentProvider = new MarkdownSlideView(context);
    const { css, js } = getAssets(context);

    function openPreviewToTheSide(uri?: vscode.Uri) {
        let resource = uri;
        if (!(resource instanceof vscode.Uri)) {
            if (vscode.window.activeTextEditor) {
                // we are relaxed and don't check for markdown files
                resource = vscode.window.activeTextEditor.document.uri;
            }
        }
        contentProvider.initPreview(
            resource!,
            vscode.window.activeTextEditor!,
            {
                viewColumn: vscode.ViewColumn.Two,
                preserveFocus: true,
            }
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "markdown-slide.openPreviewToTheSide",
            openPreviewToTheSide
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (isMarkdownFile(event.document)) {
                contentProvider.update(event.document.uri);
            }
        })
    );
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            if (isMarkdownFile(event.textEditor.document)) {
                const firstVisibleScreenRow = getTopVisibleLine(
                    event.textEditor
                );
                const lastVisibleScreenRow = getBottomVisibleLine(
                    event.textEditor
                );
                const topRatio =
                    (event.selections[0].active.line - firstVisibleScreenRow) /
                    (lastVisibleScreenRow - firstVisibleScreenRow);

                contentProvider.previewPostMessage(
                    event.textEditor.document.uri,
                    {
                        command: "changeTextEditorSelection",
                        line: event.selections[0].active.line,
                        topRatio,
                    }
                );
            }
        })
    );
}

/**
 * Get the top-most visible range of `editor`.
 *
 * Returns a fractional line number based the visible character within the line.
 * Floor to get real line number
 */
export function getTopVisibleLine(
    editor: vscode.TextEditor
): number | undefined {
    if (!editor["visibleRanges"].length) {
        return undefined;
    }

    const firstVisiblePosition = editor["visibleRanges"][0].start;
    const lineNumber = firstVisiblePosition.line;
    const line = editor.document.lineAt(lineNumber);
    const progress = firstVisiblePosition.character / (line.text.length + 2);
    return lineNumber + progress;
}

/**
 * Get the bottom-most visible range of `editor`.
 *
 * Returns a fractional line number based the visible character within the line.
 * Floor to get real line number
 */
export function getBottomVisibleLine(
    editor: vscode.TextEditor
): number | undefined {
    if (!editor["visibleRanges"].length) {
        return undefined;
    }

    const firstVisiblePosition = editor["visibleRanges"][0].end;
    const lineNumber = firstVisiblePosition.line;
    let text = "";
    if (lineNumber < editor.document.lineCount) {
        text = editor.document.lineAt(lineNumber).text;
    }
    const progress = firstVisiblePosition.character / (text.length + 2);
    return lineNumber + progress;
}

function getAssets(context: vscode.ExtensionContext) {
    const files = readdirSync(path.join(context.extensionPath, assetsPath));
    const js = [] as vscode.Uri[];
    const css = [] as vscode.Uri[];

    files.forEach((file) => {
        if (/.*\.js$/.test(file)) {
            js.push(getDiskPath(context, file));
        } else if (/.*\.css$/.test(file)) {
            css.push(getDiskPath(context, file));
        }
    });
    return { css, js };
}

// this method is called when your extension is deactivated
export function deactivate() {}
