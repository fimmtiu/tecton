const segmentsPerSide = 10;

/*
const squarePlus2 = x => x * x + 2;
const root = (x) => {
    Math.sqrt(x - 2);
}
*/

//scale += 1/5 * scale
//scale = 1.2 * scale

const EPSILON = 1.0 / 9007199254740992.0;

// const EPSILON = 1.0/77;


const correctScale = (scale) => scale * (1 + EPSILON);

const uncorrectScale = (correctedScale) =>  correctedScale / (1 + EPSILON);

function getUncorrectedScaleFromUnitUV(unitUV) {
    return Math.tan(Math.pow(Math.abs(unitUV), 1 / 6) * (Math.PI / 4));
}

function getUnitUVFromUncorrectedScale(uncorrectedScale) {
    return Math.pow(Math.atan(uncorrectedScale) / (Math.PI / 4), 6)
}

function getScaleFromUnitUV(unitUV) {
    return correctScale(getUncorrectedScaleFromUnitUV(unitUV));
}

function getUnitUVFromScale(scale) {
    return getUnitUVFromUncorrectedScale(uncorrectScale(scale));
}

// A coordinate in the range [-1, 1], where 0 is the center.
function uvWithTangentAdjustment(coordinate) {
    return (coordinate - segmentsPerSide / 2) * getScaleFromUnitUV(coordinate / segmentsPerSide * 2 - 1);
}

function getCoordinateFromUv(correctedScaledUV) {
    // MAGIC GOES HERE;
};


function inverse(scaledCellSpaceUV) {
    return 1000;
}


function testInverse(x, fn1, fn2) {
    console.log("");
    console.log(`${fn1.name} <-> ${fn2.name}`);
    let result = fn1(x);
    let inverted = fn2(result);
    console.log(JSON.stringify({x, result, inverted}, null, 2));

}


testInverse(10, correctScale, uncorrectScale);
testInverse(10, getUncorrectedScaleFromUnitUV, getUnitUVFromUncorrectedScale);
testInverse(8, getScaleFromUnitUV, getUnitUVFromScale);

/*
let n = 8;
let scaledCellSpaceUV = uvWithTangentAdjustment(n);
let inverted = inverse(scaledCellSpaceUV);
console.log(JSON.stringify({n, scaledCellSpaceUV, inverted}, null, 2));
 */