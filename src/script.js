import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import GUI from 'lil-gui'
import gsap from 'gsap'

class Earth {
    constructor(containerSelector, canvasSelector) {
        this.container = document.querySelector(containerSelector);
        this.canvas = document.querySelector(canvasSelector);
        this.scene = new THREE.Scene();

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            alpha: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.sizes = {
            width: this.container.offsetWidth,
            height: this.container.offsetHeight
        };
        this.camera = new THREE.PerspectiveCamera(
            30,
            this.sizes.width / this.sizes.height,
            1,
            1000
        );
        this.camera.position.z = 5;
        this.sphereRadius = 1;
        this.imgs = {
            'earth': './img/earth/earth_map.jpg',
            'earth_bump': './img/earth/earth_bump.jpg',
            'mark_column': './img/earth/light_column.png',
            'earthquake': './img/earth/aperture.png'
        }

        this.rotationGroup = new THREE.Group();
        this.scene.add(this.rotationGroup);

        const ambientLight = new THREE.AmbientLight('white', 1.5);
        this.directionalLight = new THREE.DirectionalLight('white', 2.5);

        // position light
        this.directionalLight.position.set(-15, 21, 11);
        this.scene.add(ambientLight, this.directionalLight)

        this.textureLoader = new THREE.TextureLoader();
        this.lightTexture = this.textureLoader.load(this.imgs.mark_column);
        this.earthquakeTexture = this.textureLoader.load(this.imgs.earthquake);
    }

    init() {
        let
            sizes,
            scene,
            camera,
            baseMesh;

        const setScene = () => {
            sizes = this.sizes;
            scene = this.scene;
            camera = this.camera;

            setControls();
            setBaseSphere();
            resize();
            this.animate();
        }

        const setControls = () => {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 2;
            this.controls.enableDamping = true;
            this.controls.enableRotate = true;
            // this.controls.enablePan = false;
            // this.controls.enableZoom = false;
            // this.controls.minPolarAngle = (Math.PI / 2) - 0.5;
            // this.controls.maxPolarAngle = (Math.PI / 2) + 0.5;
        };

        const setBaseSphere = () => {
            const baseSphere = new THREE.SphereGeometry(this.sphereRadius, 35, 35);
            const material = new THREE.MeshPhongMaterial();

            // earth map
            const earthMap = this.textureLoader.load(
                this.imgs.earth
            );
            material.map = earthMap;

            // bump
            const earthBump = this.textureLoader.load(
                this.imgs.earth_bump
            );
            material.bumpMap = earthBump;
            material.bumpScale = 0.005;

            baseMesh = new THREE.Mesh(baseSphere, material);
            baseMesh.visible = true;

            scene.add(baseMesh);

            this.baseMesh = baseMesh;
            this.rotationGroup.add(this.baseMesh);
        }

        const resize = () => {
            sizes = {
                width: this.container.offsetWidth,
                height: this.container.offsetHeight
            };

            camera.aspect = sizes.width / sizes.height;
            camera.updateProjectionMatrix();

            this.renderer.setSize(sizes.width, sizes.height);
        }

        setScene();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => resize(), 300);
        });
    }

    calc_pos_from_lat_lon = (lon, lat) => {
        var phi = (90 - lat) * (Math.PI / 180);
        var theta = (lon + 180) * (Math.PI / 180);

        const x = -(this.sphereRadius * Math.sin(phi) * Math.cos(theta));
        const z = (this.sphereRadius * Math.sin(phi) * Math.sin(theta));
        const y = (this.sphereRadius * Math.cos(phi));

        return new THREE.Vector3(x, y, z);
    }

    add_earth_marker = (lat, lng) => {
        const position = this.calc_pos_from_lat_lon(lng, lat);

        // 計算法線方向
        const normal = position.clone().normalize();

        // 建立標記
        const markerGeo = new THREE.CircleGeometry(0.02, 32);
        const markerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(position);
        marker.lookAt(new THREE.Vector3(0, 0, 0)); // 確保標記面朝地球中心
        this.rotationGroup.add(marker);

        // 產生發光光柱
        const lightHeight = 0.4; // 光柱高度
        const lightGeo = new THREE.CylinderGeometry(0.05, 0.05, lightHeight, 32, 1, true); // 開啟 `openEnded`

        const lightMat = new THREE.MeshBasicMaterial({
            map: this.lightTexture,
            transparent: true,
            opacity: 0.8
        });

        const lightColumn = new THREE.Mesh(lightGeo, lightMat);

        // 設置光柱位置，使其底部貼合地球表面
        lightColumn.position.copy(position);
        lightColumn.position.add(normal.clone().multiplyScalar(lightHeight / 2));

        // 讓 Cylinder 方向與法線對齊
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
        lightColumn.applyQuaternion(quaternion);

        this.rotationGroup.add(lightColumn);

        // 添加地震擴散效果
        this.add_earthquake_effect(marker);
    }

    add_earthquake_effect = (marker) => {
        const geometry = new THREE.PlaneGeometry(0.08, 0.08);
        const material = new THREE.MeshBasicMaterial({
            map: this.earthquakeTexture,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
        });
    
        const wave = new THREE.Mesh(geometry, material);
        const position = marker.position.clone();
        wave.position.copy(position);
    
        // 讓震波對齊地球表面
        const normal = position.normalize();
        wave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    
        this.rotationGroup.add(wave);
    
        // **使用 GSAP 進行動畫**
        gsap.to(wave.scale, {
            x: 2 + Math.random() * 1.5, // 隨機擴展範圍
            y: 2 + Math.random() * 1.5,
            duration: 1.5 + Math.random(), // 隨機動畫時間
            ease: "power2.out"
        });
    
        gsap.to(wave.material, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.out",
            onComplete: () => {
                this.rotationGroup.remove(wave);
                wave.geometry.dispose();
                wave.material.dispose();
            }
        });
    
        // **讓震波週期性出現，間隔時間隨機**
        setTimeout(() => this.add_earthquake_effect(marker), 2000 + Math.random() * 1500);
    }

    draw_fly_arc = (lat1, lon1, lat2, lon2) => {
        let flyLineOptions = { color: 0xFFA042, flyLineColor: 0xFFC78E };
        const start = this.calc_pos_from_lat_lon(lon1, lat1);
        const end = this.calc_pos_from_lat_lon(lon2, lat2);
    
        // 計算球面距離
        const distance = start.distanceTo(end);
    
        // **映射距離到高度範圍 (1.3 ~ 2.3)**
        let minHeight = 1.3;
        let maxHeight = 2.3;
        let normalizedDistance = Math.min(1, distance / 80); // 假設 80 為最大參考距離
        let arcHeight = minHeight + normalizedDistance * (maxHeight - minHeight);
    
        // 計算貝茲曲線中點，使弧線較高
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(this.sphereRadius * arcHeight);
    
        function quadraticBezier(t, p0, p1, p2) {
            return new THREE.Vector3(
                (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
                (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
                (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z
            );
        }
    
        const curvePoints = [];
        for (let i = 0; i <= 100; i++) {
            curvePoints.push(quadraticBezier(i / 100, start, mid, end));
        }
    
        const positions = [];
        curvePoints.forEach((p) => positions.push(p.x, p.y, p.z));
    
        // 使用 Line2 和 LineMaterial
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
    
        const material = new LineMaterial({
            color: flyLineOptions.flyLineColor,
            linewidth: 2,  // 調整這裡來增加線條的寬度
            transparent: true,
            opacity: 0.8,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            dashed: false
        });
    
        const line = new Line2(geometry, material);
        line.computeLineDistances();
        this.rotationGroup.add(line);
    
        // 飛行物體 (錐形)
        const coneGeo = new THREE.CylinderGeometry(0, 0.01, 0.12, 6);
        const coneMat = new THREE.MeshBasicMaterial({
            color: flyLineOptions.color,
            transparent: true
        });
        const movingCone = new THREE.Mesh(coneGeo, coneMat);
        line.add(movingCone);
    
        // // 使用 GSAP 來讓動畫更順滑
        gsap.to({ progress: 0 }, {
            progress: 1,
            duration: 2 + Math.random() * 2, // 🔥 隨機動畫時間
            repeat: -1,
            ease: "power2.inOut",
            delay: Math.random() * 2,  // 🔥 隨機延遲
            onUpdate: function () {
                let t = this.targets()[0].progress;
                const position = quadraticBezier(t, start, mid, end);
                movingCone.position.set(position.x, position.y, position.z);
        
                const tangent = new THREE.Vector3()
                    .subVectors(quadraticBezier(t + 0.01, start, mid, end), position)
                    .normalize();
                const axis = new THREE.Vector3(0, -1, 0);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, tangent);
                movingCone.setRotationFromQuaternion(quaternion);
            }
        });
    
        this.rotationGroup.add(line);
    }

    animate = () => {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));
    };    

    gui() {
        // gui
        const gui = new GUI();

        let settings, folder;

        // 使用 gui.add 的物件必須為一個具有數值屬性的物件，例如 THREE.Vector3
        const lightFolder = gui.addFolder('Directional Light');
        lightFolder.add(this.directionalLight.position, 'x', -100, 100, 0.1).name('Position X');
        lightFolder.add(this.directionalLight.position, 'y', -100, 100, 0.1).name('Position Y');
        lightFolder.add(this.directionalLight.position, 'z', -100, 100, 0.1).name('Position Z');
        lightFolder.add(this.directionalLight, 'intensity', 0, 5, 0.1).name('Light Intensity');
        lightFolder.add(this.directionalLight.shadow.camera, 'left', -50, 50, 0.1).name('Shadow camera left').onChange(() => {
            this.directionalLight.shadow.camera.updateProjectionMatrix();
        });
        lightFolder.add(this.directionalLight.shadow.camera, 'right', -50, 50, 0.1).name('Shadow camera right').onChange(() => {
            this.directionalLight.shadow.camera.updateProjectionMatrix();
        });
        lightFolder.add(this.directionalLight.shadow.camera, 'top', -50, 50, 0.1).name('Shadow camera top').onChange(() => {
            this.directionalLight.shadow.camera.updateProjectionMatrix();
        });
        lightFolder.add(this.directionalLight.shadow.camera, 'bottom', -50, 50, 0.1).name('Shadow camera bottom').onChange(() => {
            this.directionalLight.shadow.camera.updateProjectionMatrix();
        });
        lightFolder.close();

        // 添加 GUI 控制
        folder = gui.addFolder('Sphere');
        settings = {
            showSphere: true
        };
        folder.add(settings, "showSphere").name("Show sphere").onChange((value) => {
            this.baseMesh.visible = value;
        });
        folder.close();
    }
}

// ============================

const earth = new Earth('.container', '.webgl');
earth.init();
earth.gui();

let lat_lons, target_lat_lon, i, lat_lon;
lat_lons = [
    [-23.381195, 135.039595],
    [27.677807, 74.006751],
    [14.3545, 120.5838],
];
target_lat_lon = [-23.381195, 135.039595];

for (i = 0; i < lat_lons.length; i ++) {
    lat_lon = lat_lons[i];
    earth.add_earth_marker(lat_lon[0], lat_lon[1]);
    if (lat_lon[0] == target_lat_lon[0] && lat_lon[1] == target_lat_lon[1]) {
        continue;
    }
    earth.draw_fly_arc(lat_lon[0], lat_lon[1], target_lat_lon[0], target_lat_lon[1]);
}