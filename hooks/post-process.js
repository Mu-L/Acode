/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const buildFilePath = path.resolve(__dirname, '../build.json');
const copyToPath = path.resolve(__dirname, '../platforms/android/build.json');
const gradleFilePath = path.resolve(__dirname, '../build-extras.gradle');
const androidGradleFilePath = path.resolve(
  __dirname,
  '../platforms/android/app/build-extras.gradle'
);
const resPath = path.resolve(__dirname, '../platforms/android/app/src/main/res/');
const localResPath = path.resolve(__dirname, '../res/android/');

if (
  !fs.existsSync(copyToPath)
  && fs.existsSync(buildFilePath)
) fs.copyFileSync(buildFilePath, copyToPath);

if (fs.existsSync(androidGradleFilePath)) fs.unlinkSync(androidGradleFilePath);
fs.copyFileSync(gradleFilePath, androidGradleFilePath);

deleteDirRecursively(resPath, [
  path.join('values', 'strings.xml'),
  path.join('values', 'colors.xml'),
  path.join('values', 'styles.xml'),
  'anim',
  'xml',
]);
copyDirRecursively(localResPath, resPath);
enableLegacyJni()


function enableLegacyJni() {
  const prefix = execSync('npm prefix').toString().trim();
  const gradleFile = path.join(prefix, 'platforms/android/app/build.gradle');

  if (!fs.existsSync(gradleFile)) return;

  let content = fs.readFileSync(gradleFile, 'utf-8');
  // Check for correct block to avoid duplicate insertion
  if (content.includes('useLegacyPackaging = true')) return;

  // Inject under android block with correct Groovy syntax
  content = content.replace(/android\s*{/, match => {
    return (
      match +
      `
    packagingOptions {
        jniLibs {
            useLegacyPackaging = true
        }
    }`
    );
  });

  fs.writeFileSync(gradleFile, content, 'utf-8');
  console.log('[Cordova Hook] ✅ Enabled legacy JNI packaging');
}

/**
 * Copy directory recursively
 * @param {string} src Source directory
 * @param {string} dest Destination directory
 * @param {string[]} skip Files to not copy
 */
function copyDirRecursively(src, dest, skip = [], currPath = '') {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (!exists) {
    console.log(`File ${src} does not exist`);
    return;
  }

  if (!fs.existsSync(dest) && isDirectory) {
    fs.mkdirSync(dest);
  }

  if (exists && isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      const relativePath = path.join(currPath, childItemName);
      if (childItemName.startsWith('.')) return;
      if (skip.includes(childItemName) || skip.includes(relativePath)) return;
      copyDirRecursively(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        skip,
        childItemName,
      );
    });
  } else {
    fs.copyFileSync(src, dest);

    // log
    const message = `copied: ${path.basename(src)}`;
    console.log('\x1b[32m%s\x1b[0m', message); // green
  }
}

/**
 * Delete directory recursively
 * @param {string} dir Directory to delete
 * @param {string[]} except Files to not delete
 */
function deleteDirRecursively(dir, except = [], currPath = '') {
  const exists = fs.existsSync(dir);
  const stats = exists && fs.statSync(dir);
  const isDirectory = exists && stats.isDirectory();

  if (!exists) {
    console.log(`File ${dir} does not exist`);
    return;
  }

  if (exists && isDirectory) {
    let deleteDir = true;
    fs.readdirSync(dir).forEach((childItemName) => {
      const relativePath = path.join(currPath, childItemName);
      if (
        childItemName.startsWith('.')
        || except.includes(childItemName)
        || except.includes(relativePath)
      ) {
        console.log('\x1b[33m%s\x1b[0m', `skipped: ${relativePath}`); // yellow
        deleteDir = false;
        return;
      }

      deleteDirRecursively(
        path.join(dir, childItemName),
        except,
        childItemName,
      );
    });

    if (deleteDir) {
      console.log('\x1b[31m%s\x1b[0m', `deleted: ${currPath || path.basename(dir)}`); // red
      fs.rmSync(dir, { recursive: true });
    }
  } else {
    console.log('\x1b[31m%s\x1b[0m', `deleted: ${currPath || path.basename(dir)}`); // red
    fs.rmSync(dir);
  }
}
