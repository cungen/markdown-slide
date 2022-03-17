import * as vscode from "vscode";
import * as path from "path";
import { readdirSync } from "fs";

export const assetsPath = "dist/assets";
export function getDiskPath(
    context: vscode.ExtensionContext,
    fileName: string
) {
    const onDiskPath = vscode.Uri.file(
        path.join(context.extensionPath, assetsPath, fileName)
    );
    return onDiskPath.with({ scheme: "vscode-resource" });
}

export function getAssets(context: vscode.ExtensionContext) {
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

export function getWebviewContent(context: vscode.ExtensionContext) {
    const { css, js } = getAssets(context);
    const styles = css
        .map((item) => `<link rel="stylesheet" href="${item}" />`)
        .join("\n");
    const scripts = js
        .map((item) => `<script type="module" src="${item}"></script>`)
        .join("\n");

    return `<!DOCTYPE html>
	<html lang="en">
	<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${styles}
	</head>
	<body>
        <div id="app"></div>
        ${scripts}
	</body>
	</html>`;
}
