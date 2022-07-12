const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { groth16, plonk } = require("snarkjs");

const wasm_tester = require("circom_tester").wasm;

const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;
exports.p = Scalar.fromString(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const Fr = new F1Field(exports.p);

describe("HelloWorld", function () {
  this.timeout(100000000);
  let Verifier;
  let verifier;

  beforeEach(async function () {
    Verifier = await ethers.getContractFactory("HelloWorldVerifier");
    verifier = await Verifier.deploy();
    await verifier.deployed();
  });

  it("Circuit should multiply two numbers correctly", async function () {
    const circuit = await wasm_tester("contracts/circuits/HelloWorld.circom");

    const INPUT = {
      a: 2,
      b: 3,
    };

    const witness = await circuit.calculateWitness(INPUT, true);

    //console.log(witness);

    assert(Fr.eq(Fr.e(witness[0]), Fr.e(1)));
    assert(Fr.eq(Fr.e(witness[1]), Fr.e(6)));
  });

  it("Should return true for correct proof", async function () {
    //generating a proof and obtaining the circuit output using the SnarkJS library
    const { proof, publicSignals } = await groth16.fullProve(
      { a: "2", b: "3" },
      "contracts/circuits/HelloWorld/HelloWorld_js/HelloWorld.wasm",
      "contracts/circuits/HelloWorld/circuit_final.zkey"
    );
    //Displaying the circuit output as a result of multiplication
    console.log("2x3 =", publicSignals[0]);
    //Preparing the calldata for the verification call of the smart contract
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
      //remove brackets and quotes
      .replace(/["[\]\s]/g, "")
      //split the string into an array of strings on commas
      .split(",")
      //convert the strings to BigInt numbers
      .map((x) => BigInt(x).toString());
    //Form arrays of points on elliptic curve that are necessary for the verification
    const a = [argv[0], argv[1]];
    const b = [
      [argv[2], argv[3]],
      [argv[4], argv[5]],
    ];
    const c = [argv[6], argv[7]];
    //Separate the input signals
    const Input = argv.slice(8);
    //Call the contract verification method supplying the necessary converted arguments
    expect(await verifier.verifyProof(a, b, c, Input)).to.be.true;
  });
  it("Should return false for invalid proof", async function () {
    //Form the incorrect arrays of points and circuit output to force the verification to fail
    let a = [0, 0];
    let b = [
      [0, 0],
      [0, 0],
    ];
    let c = [0, 0];
    let d = [0];
    //Call the contract verification method expecting the verification result to be false
    expect(await verifier.verifyProof(a, b, c, d)).to.be.false;
  });
});

describe("Multiplier3 with Groth16", function () {
  let Verifier;
  let verifier;
  beforeEach(async function () {
    Verifier = await ethers.getContractFactory("Multiplier3Verifier");
    verifier = await Verifier.deploy();
    await verifier.deployed();
  });

  it("Circuit should multiply three numbers correctly", async function () {
    const circuit = await wasm_tester("contracts/circuits/Multiplier3.circom");

    const INPUT = {
      a: 2,
      b: 3,
      c: 11,
    };

    const witness = await circuit.calculateWitness(INPUT, true);
    assert(Fr.eq(Fr.e(witness[0]), Fr.e(1)));
    assert(Fr.eq(Fr.e(witness[1]), Fr.e(66)));
  });

  it("Should return true for correct proof", async function () {
    const { proof, publicSignals } = await groth16.fullProve(
      { a: "2", b: "3", c: "11" },
      "contracts/circuits/Multiplier3/Multiplier3_js/Multiplier3.wasm",
      "contracts/circuits/Multiplier3/circuit_final.zkey"
    );
    console.log("2x3x11 =", publicSignals[0]);
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
      .replace(/["[\]\s]/g, "")
      .split(",")
      .map((x) => BigInt(x).toString());
    const a = [argv[0], argv[1]];
    const b = [
      [argv[2], argv[3]],
      [argv[4], argv[5]],
    ];
    const c = [argv[6], argv[7]];
    const Input = argv.slice(8);
    expect(await verifier.verifyProof(a, b, c, Input)).to.be.true;
  });

  it("Should return false for invalid proof", async function () {
    let a = [0, 0];
    let b = [
      [0, 0],
      [0, 0],
    ];
    let c = [0, 0];
    let d = [0];
    expect(await verifier.verifyProof(a, b, c, d)).to.be.false;
  });
});

describe("Multiplier3 with PLONK", function () {
  let Verifier;
  let verifier;
  const unstringifyBigInts = (o) => {
    if (typeof o == "string" && /^[0-9]+$/.test(o)) {
      return BigInt(o);
    } else if (typeof o == "string" && /^0x[0-9a-fA-F]+$/.test(o)) {
      return BigInt(o);
    } else if (Array.isArray(o)) {
      return o.map(unstringifyBigInts);
    } else if (typeof o == "object") {
      if (o === null) return null;
      const res = {};
      const keys = Object.keys(o);
      keys.forEach((k) => {
        res[k] = unstringifyBigInts(o[k]);
      });
      return res;
    } else {
      return o;
    }
  };
  beforeEach(async function () {
    Verifier = await ethers.getContractFactory("Multiplier3Verifier_plonk");
    verifier = await Verifier.deploy();
    await verifier.deployed();
  });

  it("Should return true for correct proof", async function () {
    const { proof, publicSignals } = await plonk.fullProve(
      { a: "2", b: "3", c: "11" },
      "contracts/circuits/Multiplier3_plonk/Multiplier3_js/Multiplier3.wasm",
      "contracts/circuits/Multiplier3_plonk/circuit_final.zkey"
    );
    console.log("2x3x11 =", publicSignals[0]);

    const editedPublicSignals = unstringifyBigInts(publicSignals);
    const editedProof = unstringifyBigInts(proof);
    const calldata = await plonk.exportSolidityCallData(
      editedProof,
      editedPublicSignals
    );
    const argv = calldata.replace(/[["\]]/g, "").split(",");

    expect(await verifier.verifyProof(argv[0], [argv[1]])).to.be.true;
  });

  it("Should return false for invalid proof", async function () {
    expect(await verifier.verifyProof("0x00", ["0"])).to.be.false;
  });
});
