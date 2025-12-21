/**
 * Cross-platform path utilities for Docker volume mounting
 * Supports: Ubuntu (native), WSL, and Docker Desktop on Windows
 */

import fs from "fs";
import os from "os";
import path from "path";

/**
 * Detects the current platform environment
 * @returns {'wsl' | 'linux' | 'windows'}
 */
export function detectPlatform() {
    const platform = os.platform();

    if (platform === "win32") {
        return "windows";
    }

    if (platform === "linux") {
        // Check if running in WSL
        try {
            const procVersion = fs.readFileSync("/proc/version", "utf-8");
            if (
                procVersion.toLowerCase().includes("microsoft") ||
                procVersion.toLowerCase().includes("wsl")
            ) {
                return "wsl";
            }
        } catch (error) {
            // /proc/version doesn't exist or can't be read, assume native Linux
        }
        return "linux";
    }

    // Default to Linux for other Unix-like systems (macOS, etc.)
    return "linux";
}

/**
 * Converts a local filesystem path to a Docker-compatible path
 * @param {string} localPath - The local filesystem path
 * @returns {string} Docker-compatible path
 */
export function toDockerPath(localPath) {
    const platform = detectPlatform();

    // Normalize path separators to forward slashes
    let dockerPath = localPath.replace(/\\/g, "/");

    if (platform === "wsl") {
        // In WSL, Docker runs natively and can use WSL paths directly
        // But if the path is a Windows path (C:\...), convert to /mnt/c/...
        if (dockerPath.match(/^[A-Za-z]:/)) {
            const driveLetter = dockerPath[0].toLowerCase();
            dockerPath = `/mnt/${driveLetter}${dockerPath.substring(2)}`;
        }
        // Otherwise, WSL paths work as-is
    } else if (platform === "windows") {
        // On native Windows with Docker Desktop, convert to /c/... format
        if (dockerPath.match(/^[A-Za-z]:/)) {
            const driveLetter = dockerPath[0].toLowerCase();
            dockerPath = `/${driveLetter}${dockerPath.substring(2)}`;
        }
    }
    // On native Linux, paths work as-is

    return dockerPath;
}

/**
 * Gets the appropriate Docker command prefix for the platform
 * @returns {string} Command prefix ('docker' or 'wsl -e docker')
 */
export function getDockerCommand() {
    const platform = detectPlatform();

    // On native Windows (not WSL), we need to use WSL to run Docker
    // Note: This assumes Docker is set up to work with WSL
    if (platform === "windows") {
        return "wsl -e docker";
    }

    // On both WSL and native Linux, use docker directly
    return "docker";
}

/**
 * Builds a complete Docker run command with volume mounting
 * @param {string} imageName - Docker image name
 * @param {string} localPath - Local path to mount
 * @param {string} containerPath - Path inside container
 * @param {string} command - Command to run in container
 * @param {Object} options - Additional options
 * @param {boolean} options.removeAfter - Add --rm flag (default: true)
 * @param {string[]} options.additionalArgs - Additional Docker arguments
 * @returns {string} Complete Docker command
 */
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
