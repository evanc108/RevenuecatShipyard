const {
  withEntitlementsPlist,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const APP_GROUP_ID = "group.com.evanchang.revenuecatshipyard";
const SHARE_EXT_NAME = "ShareExtension";
const SHARE_EXT_BUNDLE_ID_SUFFIX = ".ShareExtension";
const TEAM_ID = "F7K5Y98JBK";
const DEPLOYMENT_TARGET = "15.1";

const EXTENSION_FILES = [
  "ShareViewController.swift",
  "ShareExtension-Info.plist",
  "ShareExtension.entitlements",
];

/**
 * Expo config plugin that adds the iOS Share Extension target.
 *
 * Source files live in plugins/share-extension/ and are copied to
 * ios/ShareExtension/ during prebuild so they survive --clean.
 */
function withShareExtension(config) {
  // Step 1: Add App Groups to main app entitlements
  config = withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.security.application-groups"] = [APP_GROUP_ID];
    return config;
  });

  // Step 2: Add the share extension target to the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const mainBundleId = config.ios?.bundleIdentifier ?? "com.cookwithnom.app";
    const shareBundleId = mainBundleId + SHARE_EXT_BUNDLE_ID_SUFFIX;
    const iosPath = config.modRequest.platformProjectRoot;

    // Copy extension source files from plugins/share-extension/ to ios/ShareExtension/
    const shareExtDir = path.join(iosPath, SHARE_EXT_NAME);
    const sourceDir = path.join(
      config.modRequest.projectRoot,
      "plugins",
      "share-extension"
    );

    if (!fs.existsSync(shareExtDir)) {
      fs.mkdirSync(shareExtDir, { recursive: true });
    }

    for (const file of EXTENSION_FILES) {
      const src = path.join(sourceDir, file);
      const dest = path.join(shareExtDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    // Check if target already exists to avoid duplicates
    const existingTarget = xcodeProject.pbxTargetByName(SHARE_EXT_NAME);
    if (existingTarget) {
      return config;
    }

    // Add the ShareExtension group to the project
    const shareExtGroup = xcodeProject.addPbxGroup(
      EXTENSION_FILES,
      SHARE_EXT_NAME,
      SHARE_EXT_NAME
    );

    // Add the group to the main project group
    const mainGroupId = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(shareExtGroup.uuid, mainGroupId);

    // Add the native target
    const target = xcodeProject.addTarget(
      SHARE_EXT_NAME,
      "app_extension",
      SHARE_EXT_NAME,
      shareBundleId
    );

    // Add the Swift source file to the target's Sources build phase
    xcodeProject.addBuildPhase(
      ["ShareViewController.swift"],
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid,
      undefined,
      shareExtDir
    );

    // Add an empty Resources build phase
    xcodeProject.addBuildPhase(
      [],
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid
    );

    // Set build settings for the extension target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const config_entry = configurations[key];
      if (
        typeof config_entry === "object" &&
        config_entry.buildSettings &&
        config_entry.baseConfigurationReference === undefined
      ) {
        if (
          config_entry.buildSettings.PRODUCT_NAME === `"${SHARE_EXT_NAME}"` ||
          config_entry.buildSettings.PRODUCT_NAME === SHARE_EXT_NAME
        ) {
          Object.assign(config_entry.buildSettings, {
            DEVELOPMENT_TEAM: TEAM_ID,
            CODE_SIGN_ENTITLEMENTS: `${SHARE_EXT_NAME}/${SHARE_EXT_NAME}.entitlements`,
            CODE_SIGN_STYLE: "Automatic",
            INFOPLIST_FILE: `${SHARE_EXT_NAME}/${SHARE_EXT_NAME}-Info.plist`,
            IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
            SWIFT_VERSION: "5.0",
            TARGETED_DEVICE_FAMILY: '"1"',
            PRODUCT_BUNDLE_IDENTIFIER: `"${shareBundleId}"`,
            GENERATE_INFOPLIST_FILE: "NO",
            CURRENT_PROJECT_VERSION: config.ios?.buildNumber ?? "1",
            MARKETING_VERSION: config.version ?? "1.0.0",
          });
        }
      }
    }

    // Add the extension as an embed target (Embed App Extensions build phase)
    const embedPhase = xcodeProject.addBuildPhase(
      [],
      "PBXCopyFilesBuildPhase",
      "Embed Foundation Extensions",
      xcodeProject.getFirstTarget().uuid,
      "app_extension"
    );

    // dstSubfolderSpec 13 = PlugIns (for app extensions)
    if (embedPhase && embedPhase.buildPhase) {
      embedPhase.buildPhase.dstSubfolderSpec = 13;
      embedPhase.buildPhase.dstPath = '""';
    }

    // Add the extension product to the embed phase
    const shareExtProductFile = target.pbxNativeTarget.productReference;
    if (shareExtProductFile) {
      xcodeProject.addToPbxCopyfilesBuildPhase(
        {
          fileRef: shareExtProductFile,
          basename: `${SHARE_EXT_NAME}.appex`,
          settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
        },
        "Embed Foundation Extensions",
        xcodeProject.getFirstTarget().uuid
      );
    }

    // Add target dependency — main app depends on share extension
    xcodeProject.addTargetDependency(
      xcodeProject.getFirstTarget().uuid,
      [target.uuid]
    );

    return config;
  });

  return config;
}

module.exports = withShareExtension;
