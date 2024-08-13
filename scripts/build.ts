import {
  CatppuccinFlavor,
  ColorName,
  flavorEntries,
} from "@catppuccin/palette";
import fs from "node:fs/promises";
import sharp from "sharp";
import icons from "../icons.json";
import { lookupCollection } from "@iconify/json";
import { getIconData, iconToHTML, iconToSVG, replaceIDs } from "@iconify/utils";
import consola from "consola";

try {
  consola.info("Deleting previous build...");

  await fs.rm("./dist", { recursive: true, force: true });

  consola.success("Deleted previous build.");
} catch (error) {
  consola.error("Failed to delete previous build: ", error);
  process.exit(1);
}

try {
  for (const [flavorName] of flavorEntries) {
    consola.info(`Creating ./dist/${flavorName}...`);

    await fs.mkdir(`./dist/${flavorName}`, { recursive: true });

    consola.success(`Created ./dist/${flavorName}.`);
  }
} catch (error) {
  consola.error("Failed to create build directories: ", error);
  process.exit(1);
}

const buildIcon = async (
  outpath: string,
  inputBuffer: Buffer,
  flavor: CatppuccinFlavor,
  backgroundColor: ColorName = "base"
) => {
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: flavor.colors[backgroundColor].hex,
    },
  })
    .composite([
      {
        input: inputBuffer,
        gravity: "center",
      },
    ])
    .toFormat("webp")
    .toFile(outpath);
};

const buildIconSvg = async (
  outpath: string,
  inputSvg: string,
  flavor: CatppuccinFlavor,
  backgroundColor: ColorName = "base",
  foregroundColor: ColorName = "text"
) => {
  await buildIcon(
    outpath,
    Buffer.from(
      inputSvg.replace("currentColor", flavor.colors[foregroundColor].hex)
    ),
    flavor,
    backgroundColor
  );
};

const buildIconIconify = async (
  outpath: string,
  collectionName: string,
  iconName: string,
  flavor: CatppuccinFlavor,
  backgroundColor: ColorName = "base",
  foregroundColor: ColorName = "text"
) => {
  const collectionData = await lookupCollection(collectionName);

  const iconData = getIconData(collectionData, iconName);

  if (!iconData) {
    throw new Error(
      `Icon ${iconName} of Collection ${collectionName} not found`
    );
  }

  const iconSvg = iconToSVG(iconData, {
    height: 512,
    width: 512,
  });

  const iconFull = iconToHTML(replaceIDs(iconSvg.body), iconSvg.attributes);

  await buildIconSvg(
    outpath,
    iconFull,
    flavor,
    backgroundColor,
    foregroundColor
  );
};

const buildIconVsCode = async (
  outpath: string,
  icon: string,
  flavorName: string,
  flavor: CatppuccinFlavor,
  backgroundColor: ColorName = "base"
) => {
  await buildIcon(
    outpath,
    await sharp(`./vscode-icons/icons/${flavorName}/${icon}.svg`)
      .resize(512, 512)
      .toBuffer(),
    flavor,
    backgroundColor
  );
};

try {
  consola.info(`Building ${Object.keys(icons).length} images in ${flavorEntries.length} flavors...`);

  await Promise.all(
    Object.keys(icons).map(async (icon) => {
      let srcIcon = icons[icon];
      let collection = "ctp-vscode-icons";
      let backgroundColor: ColorName | undefined;
      let foregroundColor: ColorName | undefined;

      if (typeof srcIcon !== "string") {
        srcIcon = icons[icon].icon;
        collection = icons[icon].collection;
        backgroundColor = icons[icon].background;
        foregroundColor = icons[icon].foreground;
      }

      for (const [flavorName, flavor] of flavorEntries) {
        if (collection === "ctp-vscode-icons") {
          await buildIconVsCode(
            `./dist/${flavorName}/${icon}.webp`,
            srcIcon,
            flavorName,
            flavor,
            backgroundColor
          );
        } else {
          await buildIconIconify(
            `./dist/${flavorName}/${icon}.webp`,
            collection,
            srcIcon,
            flavor,
            backgroundColor,
            foregroundColor
          );
        }
      }
    })
  );

  consola.success("Built images.");
} catch (error) {
  consola.error("Failed to build images: ", error);
  process.exit(1);
}
