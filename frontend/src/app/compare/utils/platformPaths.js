import fs from "fs";
import os from "os";
import path from "path";

export function detectPlatform() {
    const platform = os.platform();

    if (platform === "win32") {
        return "windows";
    }

    if (platform === "linux") {
        try {
            const procVersion = fs.readFileSync("/proc/version", "utf-8");
            if (
                procVersion.toLowerCase().includes("microsoft") ||
                procVersion.toLowerCase().includes("wsl")
            ) {
                return "wsl";
            }
        } catch (error) {
        }
        return "linux";
    }

    return "linux";
}

export function toDockerPath(localPath) {
    const platform = detectPlatform();

    let dockerPath = localPath.replace(/\\/g, "/");

    if (platform === "wsl") {
        if (dockerPath.match(/^[A-Za-z]:/)) {
            const driveLetter = dockerPath[0].toLowerCase();
            dockerPath = `/mnt/${driveLetter}${dockerPath.substring(2)}`;
        }
    } else if (platform === "windows") {
        if (dockerPath.match(/^[A-Za-z]:/)) {
            const driveLetter = dockerPath[0].toLowerCase();
            dockerPath = `/${driveLetter}${dockerPath.substring(2)}`;
        }
    }

    return dockerPath;
}

export function getDockerCommand() {
    const platform = detectPlatform();

    if (platform === "windows") {
        return "docker";
    }

    return "docker";
}

export function buildDockerCommand(
    imageName,
    localPath,
    containerPath,
    command,
    options = {}
) {
    const { removeAfter = true, additionalArgs = [] } = options;

    const dockerCmd = getDockerCommand();
    const dockerPath = toDockerPath(localPath);

    const args = ["run"];

    if (removeAfter) {
        args.push("--rm");
    }

    args.push(...additionalArgs);
    args.push("-v", `"${dockerPath}:${containerPath}"`);
    args.push(imageName);
    args.push(command);

    return `${dockerCmd} ${args.join(" ")}`;
}
